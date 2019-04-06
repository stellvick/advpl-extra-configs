import * as vscode from "vscode";

import { MergeAdvpl } from "./Merge";
import * as fileSystem from "fs";
import { ValidaAdvpl, Fonte, Funcao } from "analise-advpl";
import globby = require("globby");
//Cria um colection para os erros ADVPL
const collection = vscode.languages.createDiagnosticCollection("advpl");

let listaDuplicados = [];
let projeto: Fonte[] = [];
let comentFontPad: string[] = vscode.workspace
  .getConfiguration("advpl-sintaxe")
  .get("comentFontPad") as string[];
if (!comentFontPad) {
  comentFontPad = [""];
  vscode.window.showInformationMessage(
    localize("extension.noCritizeComment", "Do not critize coments!")
  );
}
const vscodeOptions = JSON.parse(
  process.env.VSCODE_NLS_CONFIG
).locale.toLowerCase();

let validaAdvpl = new ValidaAdvpl(comentFontPad, vscodeOptions);
validaAdvpl.ownerDb = vscode.workspace
  .getConfiguration("advpl-sintaxe")
  .get("ownerDb");
validaAdvpl.empresas = vscode.workspace
  .getConfiguration("advpl-sintaxe")
  .get("empresas");

if (!validaAdvpl.ownerDb) {
  validaAdvpl.ownerDb = [];
}
if (!validaAdvpl.empresas) {
  validaAdvpl.empresas = [];
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  //console.log(localize('extension.activeMessage', 'não funcionou'));
  vscode.window.showInformationMessage(
    localize("extension.activeMessage", "Active ADVPL Validation!")
  );
  vscode.workspace.onDidChangeTextDocument(validaFonte);

  //Adiciona comando de envia para Validação
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.gitValidacao", () => {
      let mergeAdvpl = new MergeAdvpl(false, validaProjeto);
      let branchAtual = mergeAdvpl.repository.headLabel;
      try {
        mergeAdvpl.merge(
          mergeAdvpl.repository,
          branchAtual,
          mergeAdvpl.branchTeste,
          false,
          false
        );
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
      mergeAdvpl.repository.checkout(branchAtual);
    })
  );
  //Adiciona comando de envia para Release
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.gitRelease", () => {
      let mergeAdvpl = new MergeAdvpl(false, validaProjeto);
      let branchAtual = mergeAdvpl.repository.headLabel;
      try {
        mergeAdvpl.merge(
          mergeAdvpl.repository,
          branchAtual,
          mergeAdvpl.branchTeste,
          true,
          false
        );
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
      mergeAdvpl.repository.checkout(branchAtual);
    })
  );
  //Adiciona comando de envia para master
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.gitMaster", () => {
      let mergeAdvpl = new MergeAdvpl(false, validaProjeto);
      let branchAtual = mergeAdvpl.repository.headLabel;
      try {
        mergeAdvpl.merge(
          mergeAdvpl.repository,
          branchAtual,
          mergeAdvpl.branchTeste,
          true,
          true
        );
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
      mergeAdvpl.repository.checkout(branchAtual);
    })
  );
  //Adiciona comando de envia para master
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.validaProjeto", () => {
      let mergeAdvpl = new MergeAdvpl(true, validaProjeto);
      try {
        validaProjeto(undefined, undefined, undefined, undefined, undefined);
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
    })
  );
  //Adiciona comando de envia para master
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.analisaTags", () => {
      let mergeAdvpl = new MergeAdvpl(true, validaProjeto);
      let branchAtual = mergeAdvpl.repository.headLabel;
      try {
        mergeAdvpl.analisaTags();
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
      mergeAdvpl.repository.checkout(branchAtual);
    })
  );
  //Adiciona comando de Atualiza Branch
  context.subscriptions.push(
    vscode.commands.registerCommand("advpl-sintaxe.atualizaBranch", () => {
      let mergeAdvpl = new MergeAdvpl(true, validaProjeto);
      let branchAtual = mergeAdvpl.repository.headLabel;
      try {
        mergeAdvpl.atualiza(mergeAdvpl.repository, branchAtual, true);
      } catch (e) {
        mergeAdvpl.falha(e.stdout);
      }
      mergeAdvpl.repository.checkout(branchAtual);
    })
  );
  if (
    vscode.workspace.getConfiguration("advpl-sintaxe").get("validaProjeto") !==
    false
  ) {
    let startTime: any = new Date();

    validaProjeto(undefined, undefined, undefined, undefined, undefined);

    let endTime: any = new Date();
    var timeDiff = endTime - startTime; //in ms
    // strip the ms
    timeDiff /= 1000;

    // get seconds
    var seconds = Math.round(timeDiff);
    console.log("Tempo gasto validacao " + seconds + " seconds");
  }
}
async function validaFonte(editor: any) {
  if (editor) {
    //verifica se a linguagem é ADVPL
    if (editor.document.languageId === "advpl") {
      if (editor.document.getText()) {
        validaAdvpl.validacao(editor.document.getText(), editor.document.uri);
        //verifica se o fonte já existe no projeto se não adiciona
        let pos = projeto.map(function(e) {
          return e.fonte.fsPath;
        });
        let posicao = pos.indexOf(editor.document.uri.fsPath);
        if (posicao === -1) {
          projeto.push(validaAdvpl.fonte);
        } else {
          projeto[posicao] = validaAdvpl.fonte;
        }
        let errosOld = Object.assign(
          [],
          collection.get(validaAdvpl.fonte.fonte)
        );
        //recupera os erros de duplicidade eles não são criticados no validaAdvpl
        let errosNew = errorVsCode(validaAdvpl.aErros);
        errosOld.forEach(erro => {
          if (
            erro.message ===
            localize(
              "extension.functionDuplicate",
              "This function is duplicated in the project!"
            )
          ) {
            errosNew.push(erro);
          }
        });
        //Limpa as mensagens do colection
        collection.delete(editor.document.uri);
        collection.set(editor.document.uri, errosNew);
        verificaDuplicados();
      }
    }
  }
}

function errorVsCode(aErros: any) {
  let vsErros: any = [];
  aErros.forEach(erro => {
    vsErros.push(
      new vscode.Diagnostic(
        new vscode.Range(erro.startLine, 0, erro.endLine, 0),
        erro.message,
        erro.severity
      )
    );
  });
  return vsErros;
}

// this method is called when your extension is deactivated
export function deactivate() {}

async function vscodeFindFilesSync(advplExtensions): Promise<string[]> {
  let globexp: any[] = [];
  for (var i = 0; i < advplExtensions.length; i++) {
    globexp.push(`**/*.${advplExtensions[i]}`);
  }
  return await globby(globexp, {
    cwd: vscode.workspace.rootPath,
    nocase: true
  });
}

async function validaProjeto(
  nGeradas: number = 0,
  tags: string[] = [],
  fileContent: string = "",
  branchAtual: string = "",
  objetoMerge: any
) {
  let objeto = this;
  let tag = tags[nGeradas];
  //percorre todos os fontes do Workspace e valida se for ADVPL
  let advplExtensions = ["prw", "prx", "prg", "apw", "apl", "tlpp"];

  let start: any = new Date();
  let files: string[] = await vscodeFindFilesSync(advplExtensions);
  let endTime: any = new Date();
  var timeDiff = endTime - start; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds
  var seconds = Math.round(timeDiff);
  console.log("Tempo gasto buscando arquivos " + seconds + " seconds");

  projeto = [];
  listaDuplicados = [];
  files.forEach((fileName: string) => {
    let file: vscode.Uri = vscode.Uri.file(
      vscode.workspace.rootPath + "\\" + fileName
    );

    console.log("Validando  " + vscode.workspace.rootPath + "\\" + file.fsPath);
    let conteudo = fileSystem.readFileSync(file.fsPath, "latin1");
    if (conteudo) {
      let start: any = new Date();
      validaAdvpl.validacao(conteudo, file);
      let endTime: any = new Date();
      var timeDiff = endTime - start; //in ms
      // strip the ms
      timeDiff /= 1000;

      // get seconds
      var seconds = Math.round(timeDiff);
      console.log("Tempo gasto analisando " + seconds + " seconds");

      projeto.push(validaAdvpl.fonte);
      //Limpa as mensagens do colection
      collection.delete(file);
      collection.set(file, errorVsCode(validaAdvpl.aErros));
      if (!fileContent && projeto.length === files.length) {
        start = new Date();
        verificaDuplicados();
        let endTime: any = new Date();
        timeDiff = endTime - start; //in ms
        // strip the ms
        timeDiff /= 1000;

        // get seconds
        seconds = Math.round(timeDiff);
        console.log(
          "Tempo gasto verificando duplicados " + seconds + " seconds"
        );

        vscode.window.showInformationMessage(
          localize("extension.finish", "End of Project Review!")
        );
      }
    } else {
      projeto.push(new Fonte(file));
      if (!fileContent && projeto.length === files.length) {
        verificaDuplicados();
        vscode.window.showInformationMessage(
          localize("extension.finish", "End of Project Review!")
        );
      }
    }
  });
}

async function verificaDuplicados() {
  let listaFuncoes = [];
  let startTime: any = new Date();
  let duplicadosAtual = [];
  //faz a análise de funções ou classes duplicadas em fontes diferentes
  let duplicados = [];
  projeto.forEach((fonte: Fonte) => {
    //verifica se o fonte ainda existe
    try {
      fileSystem.statSync(fonte.fonte.fsPath);
    } catch (e) {
      if (e.code === "ENOENT") {
        collection.delete(fonte.fonte);
        fonte = new Fonte(new vscode.Uri());
      }
    }

    fonte.funcoes.forEach((funcao: Funcao) => {
      if (
        listaFuncoes.indexOf((funcao.nome + funcao.tipo).toUpperCase()) === -1
      ) {
        listaFuncoes.push((funcao.nome + funcao.tipo).toUpperCase());
      } else {
        duplicados.push((funcao.nome + funcao.tipo).toUpperCase());
      }
    });
  });

  //guarda lista com os fontes que tem funções duplicadas
  projeto.forEach((fonte: Fonte) => {
    fonte.funcoes.forEach((funcao: Funcao) => {
      if (
        duplicados.indexOf((funcao.nome + funcao.tipo).toUpperCase()) !== -1
      ) {
        //procura a funcao nos duplicados
        let posicao = duplicadosAtual
          .map(x => x.funcao + x.tipo)
          .indexOf((funcao.nome + funcao.tipo).toUpperCase());
        if (posicao === -1) {
          duplicadosAtual.push({
            funcao: funcao.nome.toUpperCase(),
            tipo: funcao.tipo,
            fontes: [fonte]
          });
        } else {
          duplicadosAtual[posicao].fontes.push(fonte);
        }
      }
    });
  });

  //verifica se mudou a lista de funções duplicadas
  let listDuplicAtual = duplicadosAtual.map(x => x.funcao + x.tipo);
  let listDuplicOld = listaDuplicados.map(x => x.funcao + x.tipo);
  if (
    listDuplicAtual.toString() !==
    listDuplicOld.map(x => x.funcao + x.tipo).toString()
  ) {
    //Procura o que mudou
    let incluidos = listDuplicAtual.filter(
      x => listDuplicOld.indexOf(x) === -1
    );
    let excluidos = listDuplicOld.filter(
      x => listDuplicAtual.indexOf(x) === -1
    );

    //adicina novos erros
    incluidos.forEach(funcaoDuplicada => {
      //console.log(` funcaoDuplicada  ${funcaoDuplicada}`);
      //encontra nos fontes a funcao
      let incluido = duplicadosAtual[listDuplicAtual.indexOf(funcaoDuplicada)];
      incluido.fontes.forEach(fonte => {
        //console.log(` fonte  ${fonte.fonte}`);
        //busca os erros que estão no fonte
        let erros = Object.assign([], collection.get(fonte.fonte));
        fonte.funcoes.forEach(funcao => {
          //console.log(` funcao  ${funcao.nome}`);
          erros.push(
            new vscode.Diagnostic(
              new vscode.Range(funcao.linha, 0, funcao.linha, 0),
              localize(
                "extension.functionDuplicate",
                "This function is duplicated in the project!"
              ),
              vscode.DiagnosticSeverity.Error
            )
          );
        });

        //Limpa as mensagens do colection
        collection.delete(fonte.fonte);
        collection.set(fonte.fonte, erros);
      });
    });

    //remove erros corrigidos
    excluidos.forEach(funcaoCorrigida => {
      //console.log(` funcaoCorrigida  ${funcaoCorrigida}`);
      //encontra nos fontes a funcao
      let excuido = listaDuplicados[listDuplicOld.indexOf(funcaoCorrigida)];
      excuido.fontes.forEach(fonte => {
        //console.log(` fonte  ${fonte.fonte}`);
        //busca os erros que estão no fonte
        let erros = Object.assign([], collection.get(fonte.fonte));
        fonte.funcoes.forEach(funcao => {
          ///console.log(` funcao  ${funcao.nome}`);
          erros.splice(
            erros.map(X => X.range._start._line).indexOf(funcao.linha)
          );
        });

        //Limpa as mensagens do colection
        collection.delete(fonte.fonte);
        collection.set(fonte.fonte, erros);
      });
    });
  }

  //atualiza lista
  listaDuplicados = duplicadosAtual;

  let endTime: any = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds
  var seconds = Math.round(timeDiff);
  console.log(seconds + " seconds");
}

function localize(key: string, text?: string) {
  const vscodeOptions = JSON.parse(
    process.env.VSCODE_NLS_CONFIG
  ).locale.toLowerCase();
  let i18n = require("i18n");
  let locales = ["en", "pt-br"];
  i18n.configure({
    locales: locales,
    directory: __dirname + "\\locales"
  });
  i18n.setLocale(locales.indexOf(vscodeOptions) + 1 ? vscodeOptions : "en");
  return i18n.__(key);
}