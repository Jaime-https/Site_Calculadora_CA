// static/js/fasor_utils.js

export function converterRetParaPol(real, imag) {
    const complexo = math.complex(parseFloat(real) || 0, parseFloat(imag) || 0);

    // Método correto da biblioteca math.js
    const polar = complexo.toPolar();

    // Conversão de radianos para graus matematicamente idêntica à do motor CA
    let anguloGraus = (polar.phi * 180) / Math.PI;

    // Normalização do ângulo (para ficar entre -180 e 180)
    if (anguloGraus > 180) anguloGraus -= 360;
    if (anguloGraus <= -180) anguloGraus += 360;

    return {
        modulo: polar.r.toFixed(4),
        angulo: anguloGraus.toFixed(2)
    };
}

export function converterPolParaRet(modulo, angulo) {
    // Cálculo direto para evitar erros com o construtor math.unit
    const radianos = (parseFloat(angulo) || 0) * (Math.PI / 180);
    const complexo = math.complex({ r: parseFloat(modulo) || 0, phi: radianos });

    return {
        real: complexo.re.toFixed(4),
        imag: complexo.im.toFixed(4)
    };
}