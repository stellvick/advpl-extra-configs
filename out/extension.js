'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fileSystem = require("fs");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
//Cria um colection para os erros ADVPL
const collection = vscode.languages.createDiagnosticCollection('advpl');
let branchTeste = vscode.workspace.getConfiguration("advpl-sintax").get("branchTeste");
if (!branchTeste) {
    branchTeste = 'V11_Validacao';
}
let branchHomol = vscode.workspace.getConfiguration("advpl-sintax").get("branchHomologacao");
if (!branchHomol) {
    branchHomol = 'V11_Release';
}
let branchProdu = vscode.workspace.getConfiguration("advpl-sintax").get("branchProducao");
if (!branchProdu) {
    branchProdu = 'master';
}
let ownerDb = vscode.workspace.getConfiguration("advpl-sintax").get("ownerDb");
if (!ownerDb) {
    ownerDb = 'PROTHEUS';
}
function activate(context) {
    vscode.window.showInformationMessage('Validação ADVPL Ativa!');
    vscode.workspace.onDidChangeTextDocument(validaADVPL);
    //Adiciona comando de envia para Validação
    let disposableVal = vscode.commands.registerCommand('advpl-sintax.gitValidacao', () => {
        let repository = getRepository();
        if (!repository) {
            return;
        }
        let branchAtual = repository.headLabel;
        merge(repository, branchAtual, branchTeste, false, false);
    });
    context.subscriptions.push(disposableVal);
    //Adiciona comando de envia para Release
    let disposableRel = vscode.commands.registerCommand('advpl-sintax.gitRelease', () => {
        let repository = getRepository();
        if (!repository) {
            return;
        }
        let branchAtual = repository.headLabel;
        merge(repository, branchAtual, branchTeste, true, false);
    });
    context.subscriptions.push(disposableRel);
    //Adiciona comando de envia para master
    let disposable = vscode.commands.registerCommand('advpl-sintax.gitMaster', () => {
        //Faz o merge para master
        let repository = getRepository();
        if (!repository) {
            return;
        }
        let branchAtual = repository.headLabel;
        merge(repository, branchAtual, branchTeste, true, true);
    });
    context.subscriptions.push(disposable);
    //percorre todos os fontes do Workspace e valida se for ADVPL
    let advplExtensions = ['**/*.prw', '**/*.prx', '**/*.prg', '**/*.apw', '**/*.aph', '**/*.apl', '**/*.tlpp'];
    advplExtensions.forEach(extension => {
        let busca = vscode.workspace.findFiles(extension);
        busca.then((files) => {
            files.forEach(file => {
                fileSystem.readFile(file.fsPath, "latin1", (err, data) => {
                    if (err) {
                        vscode.window.showErrorMessage('Problema na validação de arquivos!');
                    }
                    else {
                        validacao(data, file);
                    }
                });
            });
        });
    });
}
exports.activate = activate;
function validaADVPL(e) {
    if (e) {
        //verifica se a linguagem é ADVPL
        if (e.document.languageId === "advpl") {
            validacao(e.document.getText(), e.document.uri);
        }
    }
}
function validacao(texto, uri) {
    let linhas = texto.split("\n");
    let aErros = Array();
    //Pega as linhas do documento ativo e separa o array por linha
    //Limpa as mensagens do colection
    collection.delete(uri);
    //let comentariosFonte = false;
    //let comentariosFuncao = false;
    //let selectTcQuery = false;
    //let comentAlteracao = false;
    let includeTotvs = false;
    let cBeginSql = false;
    let FromQuery = false;
    let JoinQuery = false;
    let cSelect = false;
    //Percorre todas as linhas
    for (var key in linhas) {
        let linha = linhas[key];
        //Verifica se adicionou o include TOTVS.CH
        if (linha.toUpperCase().search("#INCLUDE") !== -1 && linha.toUpperCase().search("TOTVS.CH") !== -1) {
            includeTotvs = true;
        }
        if (linha.toUpperCase().search("BEGINSQL\\ ") !== -1) {
            cBeginSql = true;
        }
        if (linha.toUpperCase().search("SELECT\\ ") !== -1 ||
            linha.toUpperCase().search("DELETE\\ ") !== -1 ||
            linha.toUpperCase().search("UPDATE\\ ") !== -1) {
            cSelect = true;
        }
        if (!cBeginSql && linha.toUpperCase().search("SELECT\\ ") !== -1) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'Uso INDEVIDO de Query sem o Embedded SQL.! => Utilizar: BeginSQL … EndSQL.', vscode.DiagnosticSeverity.Warning));
        }
        if (linha.toUpperCase().search("SELECT\\ ") !== -1 && linha.toUpperCase().search("\\ \\*\\ ") !== -1) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'Uso NÃO PERMITIDO de SELECT com asterisco "*".! ', vscode.DiagnosticSeverity.Warning));
        }
        if (linha.toUpperCase().search("CHR\\(13\\)") !== -1 && linha.toUpperCase().search("CHR\\(10\\)") !== -1) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'É recomendado o uso da expressão CRLF.', vscode.DiagnosticSeverity.Warning));
        }
        if (cSelect && linha.toUpperCase().search("FROM") !== -1) {
            FromQuery = true;
        }
        if (cSelect && FromQuery && linha.toUpperCase().search("JOIN") !== -1) {
            JoinQuery = true;
        }
        if (linha.toUpperCase().search("ENDSQL") !== -1 ||
            linha.toUpperCase().search("WHERE") !== -1 ||
            linha.toUpperCase().search("TCQUERY") !== -1) {
            FromQuery = false;
            cSelect = false;
        }
        if (cSelect && FromQuery && linha.toUpperCase().search(ownerDb) !== -1) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'Uso NÃO PERMITIDO do SHEMA ' + ownerDb + ' em Query. ', vscode.DiagnosticSeverity.Error));
        }
        if (cSelect && (FromQuery || JoinQuery || linha.toUpperCase().search("SET") !== -1) &&
            linha.toUpperCase().search("exp:cTable") === -1 &&
            (linha.toUpperCase().search("010") !== -1 || linha.toUpperCase().search("020") !== -1)) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'PROIBIDO Fixar tabela na  Query. ', vscode.DiagnosticSeverity.Error));
        }
        if (cSelect && JoinQuery && linha.toUpperCase().search("ON") !== -1) {
            FromQuery = false;
            JoinQuery = false;
        }
        if (linha.toUpperCase().search("CONOUT") !== -1) {
            aErros.push(new vscode.Diagnostic(new vscode.Range(parseInt(key), 0, parseInt(key), 0), 'Uso NÃO PERMITIDO do Conout. => Utilizar a API de Log padrão (FWLogMsg).', vscode.DiagnosticSeverity.Warning));
        }
    }
    if (!includeTotvs) {
        aErros.push(new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), 'Falta o include TOTVS.CH !', vscode.DiagnosticSeverity.Warning));
    }
    collection.set(uri, aErros);
}
function merge(repository, branchAtual, branchdestino, enviaHomolog, enviaMaster) {
    let branchesControladas = [branchHomol.toLocaleUpperCase, branchTeste.toLocaleUpperCase, branchProdu.toLocaleUpperCase];
    //verifica se não está numa branch controlada
    if (branchesControladas.indexOf(branchAtual.toUpperCase()) === 0) {
        vscode.window.showErrorMessage('Essa branch não pode ser utilizada para para Merge!');
        return;
    }
    else {
        //Trata quando a branche ainda não subiu para o GIT
        if (!repository.HEAD.upstream) {
            vscode.window.showErrorMessage('Publique sua branche antes de mergeá-la!');
            return;
        }
        repository.push().then((value) => {
            repository.checkout(branchdestino).then((value) => {
                repository.pull().then((value) => {
                    repository.merge(branchAtual, "").then((value) => {
                        let oComando;
                        //Se a branch destino for a master precisa criar tag
                        if (branchdestino === branchProdu) {
                            let aUltimaTag = [0, 0, 0];
                            let commit;
                            //Verifica ultima tag
                            repository.refs.forEach((item) => {
                                //verifica se é TAG
                                if (item.type === 2) {
                                    //Verifica se é padrão de numeração
                                    let aNiveis = item.name.split('.');
                                    if (aNiveis.length === 3) {
                                        let aTag = [Number(aNiveis[0]), Number(aNiveis[1]), Number(aNiveis[2])];
                                        if (aTag[0] >= aUltimaTag[0]) {
                                            if (aTag[1] >= aUltimaTag[1]) {
                                                if (aTag[2] >= aUltimaTag[2]) {
                                                    aUltimaTag = aTag;
                                                    commit = item.commit;
                                                }
                                            }
                                        }
                                    }
                                }
                            });
                            if (aUltimaTag[2] === 9) {
                                aUltimaTag[2] = 0;
                                aUltimaTag[1]++;
                            }
                            else {
                                aUltimaTag[2]++;
                            }
                            if (commit !== repository.HEAD.commit) {
                                oComando = repository.tag(String(aUltimaTag[0]) + "." + String(aUltimaTag[1]) + "." + String(aUltimaTag[2]), '');
                            }
                            else {
                                oComando = repository.push();
                            }
                        }
                        else {
                            oComando = repository.push();
                        }
                        oComando.then((value) => {
                            repository.push().then((value) => {
                                repository.checkout(branchAtual).then((value) => {
                                    if (enviaHomolog) {
                                        merge(repository, branchAtual, branchHomol, false, enviaMaster);
                                    }
                                    else {
                                        if (enviaMaster) {
                                            merge(repository, branchAtual, branchProdu, false, false);
                                        }
                                        else {
                                            repository.pushTags();
                                            sucesso("", "Merge de finalizado " + repository.headLabel + " -> " + branchdestino + ".");
                                        }
                                    }
                                    return;
                                });
                            }).catch(function () {
                                falha(repository.headLabel + " " + arguments[0]);
                                repository.checkout(branchAtual);
                                return;
                            });
                        }).catch(function () {
                            falha(repository.headLabel + " " + arguments[0]);
                            repository.checkout(branchAtual);
                            return;
                        });
                    }).catch(function () {
                        falha(repository.headLabel + " " + arguments[0]);
                        repository.checkout(branchAtual);
                        return;
                    });
                }).catch(function () {
                    falha(repository.headLabel + " " + arguments[0]);
                    repository.checkout(branchAtual);
                    return;
                });
            }).catch(function () {
                falha(repository.headLabel + " " + arguments[0]);
                repository.checkout(branchAtual);
                return;
            });
        }).catch(function () {
            falha(repository.headLabel + " " + arguments[0]);
            repository.checkout(branchAtual);
            return;
        });
    }
}
function getRepository() {
    if (vscode) {
        let git = vscode.extensions.getExtension('vscode.git');
        if (git) {
            if (git.isActive) {
                if (vscode.window.activeTextEditor) {
                    let repository = git.exports._model.getRepository(vscode.window.activeTextEditor.document.uri);
                    // set resource groups
                    if (repository.mergeGroup.resourceStates.length !== 0 ||
                        repository.indexGroup.resourceStates.length !== 0 ||
                        repository.workingTreeGroup.resourceStates.length !== 0) {
                        vscode.window.showErrorMessage("Merge não realizado, existem arquivos não commitados!");
                        return;
                    }
                    return repository;
                }
            }
        }
    }
}
function sucesso(value, rotina) {
    vscode.window.showInformationMessage('FUNCIONOU ' + rotina + " [" + value + "]");
}
function falha(rotina) {
    vscode.window.showErrorMessage('ERRO ' + rotina + "!");
}
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map