"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
//Criação sincrona de funções do git
function gitCheckoutSync(objeto, destino) {
    return __awaiter(this, void 0, void 0, function* () {
        return objeto.repository.checkout(destino);
    });
}
function gitMergeSync(repository, branchOrigem) {
    return __awaiter(this, void 0, void 0, function* () {
        return repository.merge(branchOrigem, "");
    });
}
function gitTagSync(repository, tag) {
    return __awaiter(this, void 0, void 0, function* () {
        return repository.tag(tag, "");
    });
}
function gitPushSync(repository) {
    return __awaiter(this, void 0, void 0, function* () {
        repository.pushTags();
        return repository.push();
    });
}
function gitPullSync(repository) {
    return __awaiter(this, void 0, void 0, function* () {
        return repository.pull();
    });
}
class MergeAdvpl {
    constructor(forca, fnValidacao) {
        this.fnValidacao = fnValidacao;
        //Busca Configurações do Settings
        this.branchTeste = vscode_1.workspace
            .getConfiguration("advpl-sintaxe")
            .get("branchTeste");
        if (!this.branchTeste) {
            this.falha(localize("merge.noBranch"));
            return;
        }
        this.branchHomol = vscode_1.workspace
            .getConfiguration("advpl-sintaxe")
            .get("branchHomologacao");
        if (!this.branchHomol) {
            this.falha(localize("merge.noBranch"));
            return;
        }
        this.branchProdu = vscode_1.workspace
            .getConfiguration("advpl-sintaxe")
            .get("branchProducao");
        if (!this.branchProdu) {
            this.falha(localize("merge.noBranch"));
            return;
        }
        this.branchesControladas = Array();
        this.branchesControladas.push(this.branchHomol.toLocaleUpperCase.toString());
        this.branchesControladas.push(this.branchTeste.toLocaleUpperCase.toString());
        this.branchesControladas.push(this.branchProdu.toLocaleUpperCase.toString());
        this.repository = this.getRepository(forca);
    }
    merge(repository, branchAtual, branchdestino, enviaHomolog, enviaMaster) {
        return __awaiter(this, void 0, void 0, function* () {
            //guarda objeto this
            let objeto = this;
            let tagName = "";
            //verifica se não está numa branch controlada
            if (objeto.branchesControladas.indexOf(branchAtual.toUpperCase()) !== -1) {
                vscode_1.window.showErrorMessage(localize("merge.noBranchMerge"));
                return;
            }
            else {
                //Trata quando a branche ainda não subiu para o GIT
                if (!repository.HEAD.upstream) {
                    vscode_1.window.showErrorMessage(localize("merge.noPush"));
                    return;
                }
                // se estiver na branche inicial efetua a atualização antes de iniciar o merge
                if (objeto.getRepository(true).headLabel === branchAtual) {
                    try {
                        yield objeto.atualiza(objeto.repository, branchAtual);
                    }
                    catch (e) {
                        return;
                    }
                }
                try {
                    yield gitPushSync(repository);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.pushError") + "\n" + e.stdout);
                    return;
                }
                try {
                    yield gitCheckoutSync(objeto, branchdestino);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.checkoutError") + "\n" + e.stdout);
                    return;
                }
                try {
                    yield gitPullSync(repository);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.pullError") + "\n" + e.stdout);
                    return;
                }
                let branchOriginal = undefined;
                //se for merge para produção usa no merge a branch de homologação
                if (branchdestino === objeto.branchProdu) {
                    branchOriginal = branchAtual;
                    branchAtual = objeto.branchHomol;
                }
                try {
                    yield gitMergeSync(repository, branchAtual);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.mergeError") + "\n" + e.stdout);
                    return;
                }
                //Se a branch destino for a master precisa criar tag
                if (branchdestino === objeto.branchProdu) {
                    let aUltimaTag = [0, 0, 0];
                    let commit;
                    //Verifica ultima tag
                    repository.refs.forEach((item) => {
                        //verifica se é TAG
                        if (item.type === 2) {
                            //Verifica se é padrão de numeração
                            let aNiveis = item.name.split(".");
                            if (aNiveis.length === 3) {
                                let aTag = [
                                    Number(aNiveis[0]),
                                    Number(aNiveis[1]),
                                    Number(aNiveis[2])
                                ];
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
                        try {
                            tagName =
                                String(aUltimaTag[0]) +
                                    "." +
                                    String(aUltimaTag[1]) +
                                    "." +
                                    String(aUltimaTag[2]);
                            yield gitTagSync(repository, tagName);
                        }
                        catch (e) {
                            vscode_1.window.showErrorMessage(localize("merge.tagError") + "\n" + e.stdout);
                            return;
                        }
                    }
                }
                try {
                    yield gitPushSync(repository);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.pushError") + "\n" + e.stdout);
                    return;
                }
                //se for usou a branche de homologação volta o conteúdo original
                if (branchOriginal) {
                    branchAtual = branchOriginal;
                }
                if (enviaHomolog) {
                    objeto.merge(repository, branchAtual, objeto.branchHomol, false, enviaMaster);
                }
                else if (enviaMaster) {
                    objeto.merge(repository, branchAtual, objeto.branchProdu, false, false);
                }
                else {
                    try {
                        yield gitCheckoutSync(repository, branchAtual);
                    }
                    catch (e) {
                        vscode_1.window.showErrorMessage(localize("merge.checkoutError") + "\n" + e.stdout);
                        return;
                    }
                    objeto.sucesso(tagName, localize("merge.mergeFinish") +
                        branchAtual +
                        " -> " +
                        branchdestino +
                        ".");
                }
            }
        });
    }
    atualiza(repository, branchAtual, showMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            //guarda objeto this
            let objeto = this;
            //verifica se não está numa branch controlada
            if (objeto.branchesControladas.indexOf(branchAtual.toUpperCase()) !== -1) {
                vscode_1.window.showErrorMessage(localize("merge.noBranchMerge"));
                return;
            }
            else {
                try {
                    yield gitCheckoutSync(objeto, objeto.branchHomol);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.checkoutError") + "\n" + e.stdout);
                    return;
                }
                try {
                    yield gitPullSync(repository);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.pullError") + "\n" + e.stdout);
                    return;
                }
                try {
                    yield gitCheckoutSync(objeto, branchAtual);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.checkoutError") + "\n" + e.stdout);
                    return;
                }
                try {
                    yield gitMergeSync(repository, objeto.branchHomol);
                }
                catch (e) {
                    vscode_1.window.showErrorMessage(localize("merge.mergeError") + "\n" + e.stdout);
                    return;
                }
                if (showMessage) {
                    vscode_1.window.showInformationMessage(localize("merge.atualizacaoFinish"));
                }
            }
        });
    }
    analisaTags() {
        let fileContent = "TAG\tError\tWarning\tInformation\tHint\tExtension Version\n";
        let branchAtual = this.repository.headLabel;
        let objeto = this;
        let tags = [];
        let nGeradas = 0;
        //Verifica ultima tag
        objeto.repository.refs.forEach((item) => {
            //verifica se é TAG
            if (item.type === 2) {
                //Verifica se é padrão de numeração
                let aNiveis = item.name.split(".");
                if (aNiveis.length === 3) {
                    fileContent += item.name + "\t\t\t\t\n";
                    tags.push(item.name);
                }
            }
        });
        objeto.geraRelatorio(nGeradas, tags, fileContent, branchAtual);
    }
    geraRelatorio(nGeradas, tags, fileContent, branchAtual) {
        return __awaiter(this, void 0, void 0, function* () {
            let tag = tags[nGeradas];
            let objeto = this;
            console.log("TROCANDO PARA TAG " + tag);
            yield gitCheckoutSync(objeto, tag);
            this.fnValidacao(nGeradas, tags, fileContent, branchAtual, objeto);
            console.log("VALIDANDO TAG " + tag);
        });
    }
    getRepository(forca) {
        let git = vscode_1.extensions.getExtension("git");
        if (git) {
            if (git.isActive) {
                let repository;
                // se houver mais de um repositório git aberto e se houver um editor
                if (git.exports._model.repositories.length > 1 &&
                    vscode_1.window.activeTextEditor) {
                    repository = git.exports._model.getRepository(vscode_1.window.activeTextEditor.document.uri);
                }
                else if (git.exports._model.repositories.length === 1) {
                    repository = git.exports._model.repositories[0];
                }
                else {
                    let repository = git.exports._model.getRepository(vscode_1.workspace.rootPath);
                }
                // set resource groups
                if (!repository) {
                    vscode_1.window.showErrorMessage(localize("merge.noRepository"));
                    return;
                }
                // set resource groups
                if (repository.mergeGroup.resourceStates.length !== 0 ||
                    repository.indexGroup.resourceStates.length !== 0 ||
                    repository.workingTreeGroup.resourceStates.length !== 0) {
                    vscode_1.window.showErrorMessage(localize("merge.noCommited"));
                    return;
                }
                return repository;
            }
        }
    }
    sucesso(value, rotina) {
        vscode_1.window.showInformationMessage(localize("merge.success") + rotina + " [" + value + "]");
        this.fnValidacao(undefined, undefined, undefined, undefined, undefined);
    }
    falha(rotina) {
        vscode_1.window.showErrorMessage("ERRO " + rotina + "!");
        this.fnValidacao(undefined, undefined, undefined, undefined, undefined);
    }
}
exports.MergeAdvpl = MergeAdvpl;
function localize(key, text) {
    const vscodeOptions = JSON.parse(process.env.VSCODE_NLS_CONFIG).locale.toLowerCase();
    let i18n = require("i18n");
    let locales = ["en", "pt-br"];
    i18n.configure({
        locales: locales,
        directory: __dirname + "\\locales"
    });
    i18n.setLocale(locales.indexOf(vscodeOptions) + 1 ? vscodeOptions : "en");
    return i18n.__(key);
}

//# sourceMappingURL=Merge.js.map
