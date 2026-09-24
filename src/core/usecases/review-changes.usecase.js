// Caso de uso para revisar diffs desde el celular.
// Esto maneja la lógica detrás del "Tinder para código": deslizar a la derecha para aceptar o a la izquierda para descartar.
class ReviewChangesUseCase {
  constructor({ vcsPort, ideAutomationPort }) {
    this.vcs = vcsPort;
    this.ideAutomation = ideAutomationPort;
  }

  async getChanges(workspaceRoot) {
    return await this.vcs.getChanges(workspaceRoot);
  }

  async acceptAll(workspaceRoot) {
    // 1. Disparamos el atajo de la IDE (Alt+Enter) para que Antigravity cierre sus barras flotantes de diff
    if (this.ideAutomation && typeof this.ideAutomation.acceptFocusedHunk === 'function') {
      try {
        await this.ideAutomation.acceptFocusedHunk();
      } catch (_) {}
    }

    // 2. Y de inmediato mandamos git add . para que el árbol de Git quede sincronizado de verdad
    return await this.vcs.acceptAll(workspaceRoot);
  }

  async acceptFile(workspaceRoot, filePath) {
    // TRAMPA MORTAL: No llames a acceptFocusedHunk acá bajo ninguna circunstancia.
    // En Antigravity, Alt+Enter es un botón nuclear que acepta TODOS los archivos pendientes
    // del proyecto completo. Si el usuario deslizó una sola tarjeta en el celular,
    // únicamente debemos pasarle git add al archivo puntual.
    return await this.vcs.acceptFile(workspaceRoot, filePath);
  }

  async rejectAll(workspaceRoot) {
    return await this.vcs.rejectAll(workspaceRoot);
  }

  async rejectFile(workspaceRoot, filePath) {
    return await this.vcs.rejectFile(workspaceRoot, filePath);
  }

  async getStagedChanges(workspaceRoot) {
    return await this.vcs.getStagedChanges(workspaceRoot);
  }

  async getBranchInfo(workspaceRoot) {
    return await this.vcs.getBranchInfo(workspaceRoot);
  }

  async getCommitSuggestion(workspaceRoot) {
    const staged = await this.vcs.getStagedChanges(workspaceRoot);
    if (typeof this.vcs.generateSuggestedCommitMessage === 'function') {
      return this.vcs.generateSuggestedCommitMessage(staged.files);
    }
    return 'feat: update staged files';
  }

  async commitChanges(workspaceRoot, { message, push = false, remote = 'origin', branch } = {}) {
    const commitResult = await this.vcs.commit(workspaceRoot, message);
    if (!commitResult.success) {
      return commitResult;
    }

    if (push) {
      const pushResult = await this.vcs.push(workspaceRoot, remote, branch);
      return {
        ...commitResult,
        pushed: pushResult.success,
        pushOutput: pushResult.output || pushResult.error
      };
    }

    return {
      ...commitResult,
      pushed: false
    };
  }
}

module.exports = { ReviewChangesUseCase };
