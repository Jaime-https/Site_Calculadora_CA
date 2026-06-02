// static/js/circuit_solver_engine_ac.js

export class CircuitEngineAC {
  constructor() {
    this.meshes = [];
    this.components = [];
  }

  addMesh() {
    const id = this.meshes.length + 1;
    this.meshes.push(id);
    return id;
  }

  // --- FUNÇÕES UTILITÁRIAS DE CONVERSÃO (Fundações dos Dias 3 e 4) ---

  /**
   * Converte Módulo e Ângulo (Graus) para um objeto complexo math.js (Retangular)
   */
  polarToRect(mod, angDeg) {
    const angRad = (Number(angDeg) * Math.PI) / 180;
    return math.complex({ r: Number(mod), phi: angRad });
  }

  /**
   * Converte um objeto complexo math.js (Retangular) para Polar (Graus)
   */
  rectToPolar(complexObj) {
    const polar = complexObj.toPolar();
    let angDeg = (polar.phi * 180) / Math.PI;

    // Normaliza o ângulo para a faixa de -180° a 180°
    if (angDeg > 180) angDeg -= 360;
    if (angDeg <= -180) angDeg += 360;

    return {
      mod: polar.r,
      ang: angDeg
    };
  }

  addImpedance(mod, angDeg, m1, m2 = 0) {
    const value = this.polarToRect(mod, angDeg);
    this.components.push({ type: 'Z', value, m1: Number(m1), m2: Number(m2) });
  }

  addVoltageSourceFasor(mod, angDeg, m1, m2 = 0) {
    const value = this.polarToRect(mod, angDeg);
    this.components.push({ type: 'V', value, m1: Number(m1), m2: Number(m2) });
  }

  assembleMatrix() {
    const N = this.meshes.length;
    if (N === 0) return { Z: [], b: [] };

    const Z = Array.from({ length: N }, () => Array(N).fill(null).map(() => math.complex(0, 0)));
    const b = Array(N).fill(null).map(() => math.complex(0, 0));

    for (const c of this.components) {
      const { type, value, m1, m2 } = c;
      const i = m1 > 0 ? m1 - 1 : null;
      const j = m2 > 0 ? m2 - 1 : null;

      if (type === 'Z') {
        if (i !== null) Z[i][i] = math.add(Z[i][i], value);
        if (j !== null) Z[j][j] = math.add(Z[j][j], value);

        if (i !== null && j !== null) {
          Z[i][j] = math.subtract(Z[i][j], value);
          Z[j][i] = math.subtract(Z[j][i], value);
        }
      } else if (type === 'V') {
        if (i !== null) b[i] = math.add(b[i], value);
        if (j !== null) b[j] = math.subtract(b[j], value);
      }
    }
    return { Z, b };
  }

  solve() {
    const { Z, b } = this.assembleMatrix();
    const N = Z.length;
    if (N === 0) return { currents: [], matrix: [], vector: [] };

    const A = Z.map(row => row.map(val => val.clone()));
    const x = b.map(val => val.clone());

    for (let i = 0; i < N; i++) {
      let pivotRow = i;
      for (let r = i + 1; r < N; r++) {
        if (math.abs(A[r][i]) > math.abs(A[pivotRow][i])) pivotRow = r;
      }

      if (math.abs(A[pivotRow][i]) < 1e-12) {
        throw new Error("Sistema singular em CA. Verifique as conexões ou se inseriu impedâncias nulas.");
      }

      [A[i], A[pivotRow]] = [A[pivotRow], A[i]];
      [x[i], x[pivotRow]] = [x[pivotRow], x[i]];

      const pivot = A[i][i];

      for (let k = i; k < N; k++) A[i][k] = math.divide(A[i][k], pivot);
      x[i] = math.divide(x[i], pivot);

      for (let r = i + 1; r < N; r++) {
        const factor = A[r][i];
        if (math.abs(factor) === 0) continue;
        for (let k = i; k < N; k++) {
          A[r][k] = math.subtract(A[r][k], math.multiply(factor, A[i][k]));
        }
        x[r] = math.subtract(x[r], math.multiply(factor, x[i]));
      }
    }

    const I_rect = new Array(N).fill(null).map(() => math.complex(0, 0));
    for (let i = N - 1; i >= 0; i--) {
      let sum = x[i];
      for (let k = i + 1; k < N; k++) {
        sum = math.subtract(sum, math.multiply(A[i][k], I_rect[k]));
      }
      I_rect[i] = sum;
    }

    // --- PROCESSAMENTO DO RETORNO ESTRUTURADO ---
    // Mapeia os resultados para incluir a versão retangular e polar tratada
    const currentsParsed = I_rect.map((current) => {
      const polarData = this.rectToPolar(current);
      return {
        rectangular: current, // Objeto math.complex (real, imag)
        polar: polarData       // Objeto { mod, ang } com ângulo em graus
      };
    });

    return {
      currents: currentsParsed,
      matrix: Z,
      vector: b
    };
  }
}