// static/js/circuit_solver_engine.js
export class CircuitEngine {
  constructor() {
    this.meshes = [];
    this.components = [];
  }

  addMesh() {
    const id = this.meshes.length + 1;
    this.meshes.push(id);
    return id;
  }

  addResistor(value, m1, m2 = 0) {
    this.components.push({ type: 'R', value: Number(value), m1: Number(m1), m2: Number(m2) });
  }

  addVoltageSource(value, m1, m2 = 0) {
    this.components.push({ type: 'V', value: Number(value), m1: Number(m1), m2: Number(m2) });
  }

  assembleMatrix() {
    const N = this.meshes.length;
    if (N === 0) return { M: [], b: [] };

    const M = Array.from({ length: N }, () => Array(N).fill(0));
    const b = Array(N).fill(0);

    for (const c of this.components) {
      const { type, value, m1, m2 } = c;

      const i = m1 > 0 ? m1 - 1 : null;
      const j = m2 > 0 ? m2 - 1 : null;

      if (type === 'R') {


        if (i !== null) M[i][i] += value;


        if (j !== null) M[j][j] += value;

        if (i !== null && j !== null) {
          M[i][j] -= value;
          M[j][i] -= value;
        }

      } else if (type === 'V') {


        if (i !== null) b[i] += value;

        if (j !== null) b[j] -= value;
      }
    }
    return { M, b };
  }

  solve() {
    const { M, b } = this.assembleMatrix();
    const N = M.length;
    if (N === 0) return { currents: [], matrix: [], vector: [] };

    const A = M.map(r => r.slice());
    const x = b.slice();

    for (let i = 0; i < N; i++) {
      let pivotRow = i;
      for (let r = i + 1; r < N; r++) {
        if (Math.abs(A[r][i]) > Math.abs(A[pivotRow][i])) pivotRow = r;
      }

      if (Math.abs(A[pivotRow][i]) < 1e-12) {

          throw new Error("Sistema singular (determinante zero). Verifique se as malhas estão conectadas corretamente.");
      }

      [A[i], A[pivotRow]] = [A[pivotRow], A[i]];
      [x[i], x[pivotRow]] = [x[pivotRow], x[i]];

      const pivot = A[i][i];
      for (let k = i; k < N; k++) A[i][k] /= pivot;
      x[i] /= pivot;

      for (let r = i + 1; r < N; r++) {
        const factor = A[r][i];
        if (factor === 0) continue;
        for (let k = i; k < N; k++) A[r][k] -= factor * A[i][k];
        x[r] -= factor * x[i];
      }
    }

    const I = new Array(N).fill(0);
    for (let i = N - 1; i >= 0; i--) {
      let sum = x[i];
      for (let k = i + 1; k < N; k++) sum -= A[i][k] * I[k];
      I[i] = sum;
    }

    return {
        currents: I,
        matrix: M,
        vector: b
    };
  }
}