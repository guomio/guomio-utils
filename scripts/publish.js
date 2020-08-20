#!/usr/bin/env node
/** Copy from https://github.com/mobxjs/mobx/blob/mobx6/scripts/publish.js with some changes */
/* Publish.js, publish a new version of the npm package as found in the current directory */
/* Run this file from the root of the repository */

const path = require('path');
const shell = require('shelljs');
const fs = require('fs');
const prompts = require('prompts');
const semver = require('semver');

/**
 *
 * @param {string} command
 * @param { shell.ExecOptions & { continueOnErrors: boolean; }} options
 */
function run(command, options) {
  const continueOnErrors = options && options.continueOnErrors;
  const ret = shell.exec(command, options);
  if (!continueOnErrors && ret.code !== 0) {
    exit(1);
  }
  return ret;
}

function exit(code, msg) {
  console.error(msg);
  shell.exit(code);
}

function writeJSON(path, obj) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(obj, null, 2), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  const status = run('git status --porcelain -uno', { silent: true });
  if (status.stdout.length > 0) {
    exit(0, 'You have uncommited local changes. Aborting...');
  }

  const rootPath = path.resolve(process.env.CWD || process.cwd());
  const rootPkgFile = path.join(rootPath, 'package.json');
  const rootPkg = require(rootPkgFile);

  const nextPatch = semver.inc(rootPkg.version, 'patch');
  const nextMinor = semver.inc(rootPkg.version, 'minor');
  const nextMajor = semver.inc(rootPkg.version, 'major');

  const resp = await prompts(
    [
      {
        type: 'select',
        name: 'action',
        message: 'What do you want to publish?',
        choices: [
          { title: 'Nothing, abort this', value: null },
          { title: `Patch version ${nextPatch}`, value: nextPatch },
          { title: `Minor version ${nextMinor}`, value: nextMinor },
          { title: `Major version ${nextMajor}`, value: nextMajor },
        ],
        initial: null,
      },
    ],
    { onCancel: () => exit(0) },
  );

  if (resp.action === null) {
    return;
  }

  console.log('Starting build...');
  run('npm run build');
  console.log('Build is done');

  // Check registry data
  const npmInfoRet = run(`npm info ${rootPkg.name} --json`, {
    continueOnErrors: true,
    silent: true,
  });

  if (npmInfoRet.code === 0) {
    const versions = await execute('latest');

    await writeJSON(rootPkgFile, { ...rootPkg, version: resp.action });

    run(`git add ${rootPkgFile}`);
    run(`git commit --no-verify -m "Published version ${resp.action}"`);
    run('git push');

    versions.forEach((ver) => {
      run(`git tag ${ver}`);
    });
    run('git push --tags');

    console.log('Pushed updated version & tags to git');

    exit(0);
  }

  async function execute(distTag) {
    const nextVersionParsed = semver.coerce(resp.action);
    const nextVersion = nextVersionParsed.format();

    const publishedPackageInfo = JSON.parse(npmInfoRet.stdout);
    if (publishedPackageInfo.versions.includes(nextVersion)) {
      throw new Error(`Version ${nextVersion} is already published in NPM`);
    }

    console.log(`Starting publish of ${nextVersion}...`);

    const distPath = path.resolve(__dirname, '..', 'dist');
    const verPkgFile = path.join(distPath, 'package.json');
    const verPkg = require(verPkgFile);
    await writeJSON(verPkgFile, { ...verPkg, version: nextVersion });

    run(`npm publish ${distPath} --tag ${distTag}`);
    console.log(`Published ${nextVersion} to NPM with distTag ${distTag}`);

    return nextVersion;
  }
}

main().catch((e) => {
  console.error(e);
});
