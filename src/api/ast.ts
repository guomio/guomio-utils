import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { isEmpty } from '../util';

interface SourceFile extends ts.SourceFile {
  resolvedModules?: Map<string, ts.ResolvedModuleFull>;
  importsMap?: Map<string, string>;
  typeParametersAliasMap?: Map<string, ts.TypeAliasDeclaration | ts.InterfaceDeclaration>;
}

export type Dictionary = { [key: string]: string | Dictionary };

export type PropertyDictionary = {
  key: string;
  type: string;
  value: string | PropertyDictionary[];
  comment: string;
  typeArguments?: ts.NodeArray<ts.TypeNode>;
  required: boolean;
  jsDoc: ts.JSDocTagInfo[];
};

interface Mock {
  name: string; // 变量名称
  comment: string; // mock注释
  api: ts.PropertyAccessExpression; // api实例
  types: ts.TypeNode[]; // 参数类型
  args: ts.Expression[]; // api url
}

interface MockModel {
  sourceFile: SourceFile | undefined;
  mocks: Mock[];
}

interface ApiStruct {
  config: Dictionary;
  response: PropertyDictionary[];
  method: string;
}

export interface MockDictionary {
  url: string;
  name: string;
  comment: string;
  method: string;
  headers: Record<string, string>;
  base: PropertyDictionary[];
  request: PropertyDictionary[];
  response: PropertyDictionary[];
}

export const EnumType = {
  Native: 'Native',
  TypeLiteral: 'TypeLiteral',
  TypeReference: 'TypeReference',
  ArrayType: 'ArrayType',
  TupleType: 'TupleType',
  UnionType: 'UnionType',
  string: 'string',
  boolean: 'boolean',
  number: 'number',
  unknow: 'unknow',
  undefined: 'undefined',
  null: 'null',
  any: 'any',
  Blob: 'Blob',
  FormData: 'FormData',
  invalid: 'invalid',
} as const;

interface IParseOptions {
  args: string[];
  outFile: string;
  calcFile: string;
}

const parseOptions = function (argv: string[]): IParseOptions {
  const args = argv.slice(0, 2);
  let outFile = '';
  let calcFile = '';

  const len = argv.length;

  for (let i = 2; i < len; i++) {
    const arg = argv[i];
    if (arg === '-o' || arg === '-ourFile') {
      outFile = path.resolve(argv[++i]);
      continue;
    }
    if (arg === '-c' || arg === '-calcFile') {
      calcFile = path.resolve(argv[++i]);
      continue;
    }
    if (!arg.startsWith('-')) {
      args.push(path.resolve(arg));
      continue;
    }
  }

  return { args, outFile, calcFile };
};

const pickComment = (comment?: string) => {
  const commentExec = /\[mock\](.+)\n/gi.exec(comment || '');
  return commentExec ? commentExec[1].trim() : '';
};

const readDirectory = (dirs: string[]) => {
  const files: string[] = [];
  for (let i = 0; i < dirs.length; i++) {
    if (!fs.existsSync(dirs[i])) continue;
    const dir = fs.statSync(dirs[i]);
    if (dir.isFile() && dirs[i].endsWith('.ts')) {
      files.push(dirs[i]);
      continue;
    }
    if (dir.isDirectory()) {
      files.push(...readDirectory(fs.readdirSync(dirs[i]).map((f) => path.join(dirs[i], f))));
    }
  }
  return files;
};

const flattenPropertyDictionary = (
  propertyDictionarys: PropertyDictionary[],
): PropertyDictionary[] => {
  if (propertyDictionarys.length === 1) {
    const p = propertyDictionarys[0];
    if (
      !p.comment &&
      !p.key &&
      p.type === EnumType.TypeReference &&
      !isEmpty(p.value) &&
      typeof p.value !== 'string'
    ) {
      return flattenPropertyDictionary(p.value);
    }
  }
  propertyDictionarys.forEach((p) => {
    if (
      typeof p.value !== 'string' &&
      p.value.length === 1 &&
      p.value[0].type === EnumType.Native &&
      !p.value[0].key
    ) {
      p.value = p.value[0].value;
      p.type = EnumType.Native;
    }
  });
  return propertyDictionarys;
};

function isNativeType(t: string) {
  switch (t) {
    case EnumType.Blob:
    case EnumType.FormData:
    case EnumType.Native:
      return true;

    default:
      return false;
  }
}

function visitor(sourceFile: SourceFile | undefined, callback: (node: ts.Node) => boolean | void) {
  if (!sourceFile) return;
  const v: ts.Visitor = (node: ts.Node) => {
    return callback(node) ? node : ts.forEachChild(node, v);
  };
  ts.forEachChild(sourceFile, v);
}

const SyntaxKind2Name = (node?: ts.Node) => {
  if (!node) return EnumType.invalid;

  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return EnumType.string;
    case ts.SyntaxKind.NumberKeyword:
      return EnumType.number;
    case ts.SyntaxKind.BooleanKeyword:
      return EnumType.boolean;
    case ts.SyntaxKind.UndefinedKeyword:
      return EnumType.undefined;
    case ts.SyntaxKind.NullKeyword:
      return EnumType.null;
    case ts.SyntaxKind.AnyKeyword:
      return EnumType.any;
    case ts.SyntaxKind.LiteralType:
      if (ts.isStringLiteral((node as ts.LiteralTypeNode).literal)) {
        return ((node as ts.LiteralTypeNode).literal as ts.StringLiteral).text;
      }
    case ts.SyntaxKind.TypeReference:
      const typeName = (node as ts.TypeReferenceNode).typeName;
      if (ts.isIdentifier(typeName) && isNativeType(extractIdentifierName(typeName))) {
        return extractIdentifierName(typeName);
      }
    default:
      return EnumType.unknow;
  }
};

const isUnknowSyntaxName = (kind: string) => EnumType.unknow === kind;

const extractTypeReferenceName = (node: ts.TypeNode) => {
  if (ts.isTypeReferenceNode(node)) {
    return (node.typeName as ts.Identifier).escapedText;
  }
  return '';
};

function extractIdentifierName(node: ts.Node): string {
  if (ts.isIdentifier(node)) {
    return node.escapedText.toString();
  }
  return '';
}

function extractImports(sourceFile: SourceFile) {
  const importsMap = new Map<string, string>();
  const visit = (node: ts.Node) => {
    if (ts.isNamedImports(node) && ts.isStringLiteral(node.parent.parent.moduleSpecifier)) {
      node.elements.forEach((e) => {
        importsMap.set(
          extractIdentifierName(e.name),
          (node.parent.parent.moduleSpecifier as ts.StringLiteral).text,
        );
      });
    }
  };

  visitor(sourceFile, visit);
  return importsMap;
}

function extractTypeParametersAlias(sourceFile: SourceFile) {
  const typeParametersAlias = new Map<string, ts.TypeAliasDeclaration | ts.InterfaceDeclaration>();
  const visit = (node: ts.Node) => {
    if (
      ts.isTypeAliasDeclaration(node) ||
      (ts.isInterfaceDeclaration(node) && node.typeParameters)
    ) {
      typeParametersAlias.set(node.name.getText(), node);
    }
  };
  visitor(sourceFile, visit);
  return typeParametersAlias;
}

function extractObjectLiteralExpression(node: ts.ObjectLiteralExpression): Dictionary {
  var result: Dictionary = {};
  for (const propDeclaration of node.properties) {
    if (!ts.isPropertyAssignment(propDeclaration)) continue;
    const propName = propDeclaration.name.getText();
    if (!propName) continue;
    if (ts.isObjectLiteralExpression(propDeclaration.initializer)) {
      result[propName] = extractObjectLiteralExpression(propDeclaration.initializer);
    } else {
      result[propName] = propDeclaration.initializer.getText();
    }
  }
  return result;
}

const getNodeComment = (sourceFile: SourceFile | undefined, node: ts.Node) => {
  if (!sourceFile) return '';
  if (!ts.isVariableStatement(node)) return '';

  const tags = ts.getAllJSDocTags(node, (tag): tag is ts.JSDocTag => {
    return tag.tagName.text === 'mock';
  });

  if (tags.length) return tags[0].comment;

  const fullText = sourceFile.getFullText();
  const comments = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!comments?.length) return '';

  return pickComment(fullText.slice(comments[0].pos, comments[0].end));
};

const getMockNode = (sourceFile: SourceFile | undefined, node: ts.Node): Mock | undefined => {
  if (!sourceFile) return;
  const comment = getNodeComment(sourceFile, node);
  if (!comment) return;

  const info = { comment } as Mock;

  const visit = (node: ts.Node): void => {
    switch (node.kind) {
      case ts.SyntaxKind.VariableDeclaration:
        info.name = (node as ts.VariableDeclaration).name.getText(sourceFile);
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        info.api = node as ts.PropertyAccessExpression;
        break;
      case ts.SyntaxKind.CallExpression:
        info.types = Array.from((node as ts.CallExpression).typeArguments || []);
        info.args = Array.from((node as ts.CallExpression).arguments);
        break;
      default:
        break;
    }
    return ts.forEachChild(node, visit);
  };

  visit(node);
  return info;
};

const getMockNodes = (sourceFile: SourceFile | undefined): MockModel => {
  const mocks: Mock[] = [];
  const mockVisitor = (node: ts.Node) => {
    const n = getMockNode(sourceFile, node);
    n && mocks.push(n);
  };

  visitor(sourceFile, mockVisitor);
  return {
    sourceFile,
    mocks,
  };
};

function extractApiURL(node: ts.Expression[]): string {
  if (!node.length || !ts.isStringLiteral(node[0])) return '';

  return node[0].getText().replace(/'/g, '').replace(/"/g, '');
}

function extractHeadersFromArgs(node: ts.Expression[]) {
  if (node.length < 2) return {};
  const headers: Record<string, string> = {};
  const customArg = node[1];
  if (ts.isObjectLiteralExpression(customArg)) {
    const c = extractObjectLiteralExpression(customArg);
    if (c.urlencoded === 'true') headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (c.form === 'true') headers['Content-Type'] = 'multipart/form-data';
  }
  const axiosArg = node[2];
  if (axiosArg && ts.isObjectLiteralExpression(axiosArg)) {
    const a = extractObjectLiteralExpression(axiosArg);
    Object.assign(headers, a.headers);
  }
  return headers;
}

function extractAST(files: string[]) {
  const cmd = ts.parseCommandLine(files);

  const program = ts.createProgram(cmd.fileNames, cmd.options);
  const checker = program.getTypeChecker();

  const createSourceFile = (file?: string) => {
    const files = program.getRootFileNames();
    const sourceFile = program.getSourceFile(file || files[files.length - 1]) as
      | SourceFile
      | undefined;
    if (sourceFile) {
      sourceFile.importsMap = extractImports(sourceFile);
      sourceFile.typeParametersAliasMap = extractTypeParametersAlias(sourceFile);
    }
    return sourceFile;
  };

  function extractType(
    member: ts.TypeNode | ts.PropertySignature,
    sourceFile?: SourceFile,
  ): PropertyDictionary[] {
    let symbolAtLocationNode: ts.Node;
    let typeNode: ts.TypeNode;

    if (!member) return [];

    if (ts.isPropertySignature(member)) {
      if (!member.type) return [];
      symbolAtLocationNode = member.name;
      typeNode = member.type;
    } else {
      symbolAtLocationNode = member;
      typeNode = member;
    }

    const symbol = checker.getSymbolAtLocation(symbolAtLocationNode);

    const r: PropertyDictionary = {
      type: '',
      key: symbol?.getName() || '',
      value: '',
      required: !(ts.isPropertySignature(typeNode.parent) && typeNode.parent.questionToken),
      jsDoc: symbol?.getJsDocTags() || [],
      comment:
        symbol
          ?.getDocumentationComment(checker)
          ?.map((c) => c.text)
          .join('|') || '',
    };

    switch (typeNode.kind) {
      case ts.SyntaxKind.TypeLiteral:
        r.type = EnumType.TypeLiteral;
        r.value = extractTypeLiteral(typeNode as ts.TypeLiteralNode, sourceFile);
        break;
      case ts.SyntaxKind.TypeReference:
        r.type = EnumType.TypeReference;
        const typeName = extractTypeReferenceName(typeNode);
        if (isNativeType(typeName.toString())) {
          r.type = EnumType.Native;
          r.value = typeName.toString();
          break;
        }

        const importPath = sourceFile?.importsMap?.get(typeName.toString());
        if (importPath) {
          return extractType(
            typeNode,
            createSourceFile(sourceFile?.resolvedModules?.get(importPath)?.resolvedFileName),
          );
        }

        if (!r.key && isEmpty((typeNode as ts.TypeReferenceNode).typeArguments)) {
          return extractTypeNode(sourceFile, typeName.toString());
        }

        r.value = extractTypeNode(sourceFile, typeName.toString());

        if (ts.isTypeReferenceNode(typeNode) && !isEmpty(typeNode.typeArguments)) {
          if (sourceFile?.typeParametersAliasMap?.has(typeNode.typeName.getText())) {
            const aliasTypeNode = sourceFile.typeParametersAliasMap.get(
              typeNode.typeName.getText(),
            )!;
            if (
              ts.isTypeAliasDeclaration(aliasTypeNode) &&
              ts.isTypeLiteralNode(aliasTypeNode.type)
            ) {
              r.value
                .filter((v) => v.type === EnumType.TypeReference)
                .forEach((v) => {
                  aliasTypeNode.typeParameters?.forEach((typeParam, i) => {
                    (aliasTypeNode.type as ts.TypeLiteralNode).members.forEach((member) => {
                      if (
                        ts.isPropertySignature(member) &&
                        member.type &&
                        ts.isTypeReferenceNode(member.type) &&
                        typeParam.name.getText() === member.type.typeName.getText()
                      ) {
                        v.value =
                          extractType(
                            (typeNode as ts.TypeReferenceNode).typeArguments?.[i]!,
                            sourceFile,
                          ) || v.value;
                      }
                    });
                  });
                });
            }
          }
        }
        break;
      case ts.SyntaxKind.ArrayType:
        r.type = EnumType.ArrayType;
        const elementType = (typeNode as ts.ArrayTypeNode).elementType;
        if (!isUnknowSyntaxName(SyntaxKind2Name(elementType))) {
          r.value = SyntaxKind2Name(elementType);
        } else {
          r.value = extractTypeNode(sourceFile, elementType);
        }
        break;
      case ts.SyntaxKind.TupleType:
        r.type = EnumType.TupleType;
        r.value = symbol
          ? checker.typeToString(
              checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
            )
          : typeNode.getText();
        break;
      case ts.SyntaxKind.UnionType:
        r.type = EnumType.UnionType;
        r.value = symbol
          ? checker.typeToString(
              checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
            )
          : typeNode.getText();
        break;
      default:
        r.type = EnumType.Native;
        const syntaxName = SyntaxKind2Name(typeNode);
        r.value = isUnknowSyntaxName(syntaxName) ? '' : syntaxName;
    }
    return [r];
  }

  function extractTypeElement(member: ts.TypeElement, sourceFile?: SourceFile) {
    if (!ts.isPropertySignature(member)) return;

    const symbol = checker.getSymbolAtLocation(member.name);
    if (!symbol) return;

    const propName = symbol.getName();
    if (!propName || !member.type) return;

    return extractType(member, sourceFile);
  }

  function extractTypeLiteral(
    node: ts.TypeLiteralNode | ts.InterfaceDeclaration,
    sourceFile?: SourceFile,
  ) {
    const result: PropertyDictionary[] = [];

    for (const member of node.members) {
      const r = extractTypeElement(member, sourceFile);
      if (r) {
        result.push(...r);
      }
    }
    return result;
  }

  const extractTypeNode = (
    sourceFile: MockModel['sourceFile'],
    typeNode: ts.TypeNode | string,
  ): PropertyDictionary[] => {
    let nodeRes: PropertyDictionary[] = [];

    const extract = (node: ts.Node, typeNode?: ts.TypeNode | string): PropertyDictionary[] => {
      if (!typeNode) return [];

      const typeNodeName =
        typeof typeNode === 'string' ? typeNode : extractTypeReferenceName(typeNode);

      if (ts.isTypeAliasDeclaration(node) && node.name.escapedText === typeNodeName) {
        if (ts.isTypeLiteralNode(node.type)) {
          return extractTypeLiteral(node.type, sourceFile);
        }
      }

      if (ts.isInterfaceDeclaration(node) && node.name.escapedText === typeNodeName) {
        return extractTypeLiteral(node, sourceFile);
      }

      if (typeof typeNode === 'string') {
        const importPath = sourceFile?.importsMap?.get(typeNode);
        if (importPath) {
          return extractTypeNode(
            createSourceFile(sourceFile?.resolvedModules?.get(importPath)?.resolvedFileName),
            typeNode,
          );
        }
        return [];
      }

      const t = extractType(typeNode, sourceFile);
      return t ? t : [];
    };

    const visit = (node: ts.Node) => {
      if (isEmpty(nodeRes)) {
        nodeRes = extract(node, typeNode);
        return !isEmpty(nodeRes[0]?.value);
      }
    };

    visitor(sourceFile, visit);

    return nodeRes;
  };

  function extractApiNode(
    sourceFile: SourceFile | undefined,
    apiPropertyAccessExpression: ts.PropertyAccessExpression,
  ): ApiStruct {
    const r: ApiStruct = {
      config: {},
      response: [],
      method: '',
    };
    const visit = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node)) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (
          symbol?.getName() === apiPropertyAccessExpression.expression.getText() &&
          node.initializer
        ) {
          if (ts.isNewExpression(node.initializer)) {
            const typeNode = node.initializer.typeArguments?.[0];
            const argument = node.initializer.arguments?.[0];
            if (argument && ts.isObjectLiteralExpression(argument)) {
              r.config = extractObjectLiteralExpression(argument);
            }
            r.method = extractIdentifierName(apiPropertyAccessExpression.name);
            if (typeNode) {
              r.response = extractTypeNode(sourceFile, typeNode);
              return !!r.response;
            }
          }
        }
      }
    };
    visitor(sourceFile, visit);
    if (isEmpty(r.method)) {
      const importPath = sourceFile?.importsMap?.get(
        apiPropertyAccessExpression.expression.getText(),
      );
      if (importPath) {
        return extractApiNode(
          createSourceFile(sourceFile?.resolvedModules?.get(importPath)?.resolvedFileName),
          apiPropertyAccessExpression,
        );
      }
    }
    return r;
  }

  const generateMockMap = (file?: string) => {
    const mock = getMockNodes(createSourceFile(file));
    const maps: MockDictionary[] = [];

    const gen = (sourceFile: SourceFile | undefined, mock: Mock) => {
      const api = extractApiNode(sourceFile, mock.api);
      const res = flattenPropertyDictionary(extractTypeNode(sourceFile, mock.types[0]));
      const req = flattenPropertyDictionary(extractTypeNode(sourceFile, mock.types[1]));
      const url = extractApiURL(mock.args);
      const headers = extractHeadersFromArgs(mock.args);
      Object.assign(headers, api.config.headers);

      const r: MockDictionary = {
        name: mock.name,
        comment: mock.comment,
        url,
        method: api.method,
        headers,
        base: api.response,
        response: res,
        request: req,
      };
      return r;
    };

    mock.mocks.forEach((m) => maps.push(gen(mock.sourceFile, m)));

    return maps;
  };

  return generateMockMap;
}

export function ast(argv: string[]) {
  const opts = parseOptions(argv);

  const inputFiles = opts.args.slice(2);
  const realFiles = readDirectory(inputFiles);

  const maps: MockDictionary[] = [];

  opts.args = [...opts.args.slice(0, 2), ...realFiles];

  const extract = extractAST(opts.args);

  realFiles.forEach((r) => maps.push(...extract(r)));

  if (opts.outFile) {
    fs.writeFileSync(opts.outFile, JSON.stringify(maps));
  }

  if (opts.calcFile) {
    require(opts.calcFile)(maps);
  }

  return maps;
}

export default ast;
