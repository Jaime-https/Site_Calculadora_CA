// static/js/main.js
import { CircuitEngine } from './circuit_solver_engine.js';
import { CircuitEngineAC } from './circuit_solver_engine_ac.js';
import { converterRetParaPol, converterPolParaRet } from './fasor_utils.js';

let daltonMode = '';
let malhaCount = 0;
let malhaCaCount = 0;
let currentMode = 'CC';
let dyslexicActive = false;
let mascotActive = true;

// Referências globais do DOM que serão preenchidas no DOMContentLoaded
let colorPrimary, colorSecondary, colorBg, colorText;
let fontRange, brightRange, contrastRange, saturationRange;
let fontValue, brightValue, contrastValue, saturationValue;
let settingsPanel, malhasContainer, malhasContainerCa, malhaForm, malhaFormCa, resultsInner, resultArea;
let previewName, activeThemeName;
let mascotImg, mascotContainer;

// Instâncias de Gráficos Isoladas para Evitar Conflitos
let myChart = null; // Usado no motor CC
let currentFasorChartInst = null;
let voltageFasorChartInst = null;
let sineWaveChartInst = null;
let powerTriangleChartInst = null;

// Controle de estado síncrono para alternância de cores na impressão
let isPrintingMode = false;
let lastCalculatedSolution = null;

function applyAllFilters() {
  const b = brightRange ? parseInt(brightRange.value, 10) / 100 : 1;
  const c = contrastRange ? parseInt(contrastRange.value, 10) / 100 : 1;
  const s = saturationRange ? parseInt(saturationRange.value, 10) / 100 : 1;

  if (brightValue) brightValue.innerText = Math.round(b * 100) + '%';
  if (contrastValue) contrastValue.innerText = Math.round(c * 100) + '%';
  if (saturationValue) saturationValue.innerText = Math.round(s * 100) + '%';

  let filterString = `brightness(${b}) contrast(${c}) saturate(${s})`;

  if (daltonMode === 'protanopia') filterString += ' hue-rotate(10deg) sepia(0.3)';
  else if (daltonMode === 'deuteranopia') filterString += ' hue-rotate(330deg) sepia(0.2)';
  else if (daltonMode === 'tritanopia') filterString += ' hue-rotate(180deg) sepia(0.1)';

  document.documentElement.style.filter = filterString;
}

function setDalton(type) { daltonMode = type; applyAllFilters(); }

const DEFAULTS = {
  theme: {
      primary: '#29d9ff', secondary: '#006994', bg: '#010a12', panel: '#05263b', text: '#e0fbfc',
      name: 'Neon Gélido', mascot: 'mascot_standard.png'
  },
  gamer: {
      primary: '#00ff9d', secondary: '#061722', bg: '#02040a', panel: '#0b1e15', text: '#caffff',
      name: 'Gamer', mascot: 'mascot_gamer.png'
  },
  pink: {
      primary: '#ff8fa3', secondary: '#8a2b42', bg: '#1f0a12', panel: '#2d0f1b', text: '#ffdee8',
      name: 'Pink', mascot: 'mascot_pink.png'
  },
  grey: {
      primary: '#dcdcdc', secondary: '#6e6e6e', bg: '#0a0a0a', panel: '#1a1a1a', text: '#e0e0e0',
      name: 'Nier Grey', mascot: 'mascot_grey.png'
  }
};

function applyVars(vars) {
  if (vars.primary) document.documentElement.style.setProperty('--primary', vars.primary);
  if (vars.secondary) document.documentElement.style.setProperty('--secondary', vars.secondary);
  if (vars.bg) document.documentElement.style.setProperty('--bg', vars.bg);
  if (vars.panel) document.documentElement.style.setProperty('--panel', vars.panel);
  if (vars.text) document.documentElement.style.setProperty('--text', vars.text);
  if (vars.name && activeThemeName) activeThemeName.innerText = vars.name;
  if (vars.name && previewName) previewName.innerText = vars.name;

  if (vars.mascot) changeMascot(vars.mascot);
}

function changeMascot(filename) {
    if(!mascotImg) return;
    const newSrc = `static/img/${filename}`;
    if(mascotImg.getAttribute('src').includes(filename)) return;

    mascotImg.style.opacity = '0';
    setTimeout(() => {
        mascotImg.src = newSrc;
        mascotImg.onload = () => { mascotImg.style.opacity = '1'; };
        setTimeout(() => { mascotImg.style.opacity = '1'; }, 100);
    }, 400);
}

function applyPreset(name) {
  if (DEFAULTS[name]) applyVars(DEFAULTS[name]);
  setTimeout(() => {
    const styles = getComputedStyle(document.documentElement);
    if(colorPrimary) colorPrimary.value = styles.getPropertyValue('--primary').trim();
    if(colorSecondary) colorSecondary.value = styles.getPropertyValue('--secondary').trim();
    if(colorBg) colorBg.value = styles.getPropertyValue('--bg').trim();
    if(colorText) colorText.value = styles.getPropertyValue('--text').trim();
  }, 50);
}

function updateThemeFromPickers() {
  document.documentElement.style.setProperty('--primary', colorPrimary.value);
  document.documentElement.style.setProperty('--secondary', colorSecondary.value);
  document.documentElement.style.setProperty('--bg', colorBg.value);
  document.documentElement.style.setProperty('--text', colorText.value);
  if (activeThemeName) activeThemeName.innerText = 'Personalizado';
}

function loadCircuit(type) {
    if(!malhasContainer) return;
    malhasContainer.innerHTML = '';
    malhaCount = 0;
    if(resultsInner) resultsInner.innerHTML = '';
    if(resultArea) resultArea.style.display = 'none';

    if (type === 'simple2') {
        createMeshWithData([10], [20]);
        createMeshWithData([10], [3]);
        addResToMesh(1, 5, 2);
    }
    else if (type === 'wheatstone') {
        createMeshWithData([100, 20], [10]);
        createMeshWithData([20, 50], []);
        createMeshWithData([50, 100], []);
        addResToMesh(1, 20, 2);
        addResToMesh(2, 50, 3);
        addResToMesh(1, 100, 3);
        addResToMesh(2, 5, 3);
    }
    else if (type === 'ladder') {
        createMeshWithData([10], [12]);
        createMeshWithData([10], []);
        createMeshWithData([10], []);
        addResToMesh(1, 20, 2);
        addResToMesh(2, 20, 3);
    }
}

function createMeshWithData(resistors, voltages) {
    addMalha();
    const currentId = malhaCount;
    const card = document.querySelectorAll('#malhasContainer .malha')[currentId - 1];

    card.querySelector('.res-container').innerHTML = '';
    card.querySelector('.vol-container').innerHTML = '';

    resistors.forEach(val => addResToMesh(currentId, val, 0));
    voltages.forEach(val => addVoltToMesh(currentId, val, 0));
}

function addResToMesh(meshId, val, linkTo) {
    const card = document.querySelectorAll('#malhasContainer .malha')[meshId - 1];
    const container = card.querySelector('.res-container');

    const div = document.createElement('div');
    div.className = 'field-row';
    div.innerHTML = `<input type="number" step="0.01" class="res-input" value="${val}" required>
                     <select class="mesh-selector"><option value="${linkTo}">Auto</option></select>
                     <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>`;
    container.appendChild(div);
    updateMeshDropdowns();
    div.querySelector('select').value = linkTo;
}

function addVoltToMesh(meshId, val, linkTo) {
    const card = document.querySelectorAll('#malhasContainer .malha')[meshId - 1];
    const container = card.querySelector('.vol-container');

    const div = document.createElement('div');
    div.className = 'field-row';
    div.innerHTML = `<input type="number" step="0.01" class="vol-input" value="${val}" required>
                     <select class="mesh-selector"><option value="${linkTo}">Auto</option></select>
                     <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>`;
    container.appendChild(div);
    updateMeshDropdowns();
    div.querySelector('select').value = linkTo;
}

function updateMeshDropdowns() {
  const allSelects = document.querySelectorAll('#malhasContainer .mesh-selector');
  const cards = Array.from(document.querySelectorAll('#malhasContainer .malha.panel'));

  allSelects.forEach(select => {
    const currentSelection = select.value;
    const myOwnerId = select.dataset.ownerId;

    select.innerHTML = '';
    const optGND = document.createElement('option');
    optGND.value = '0';
    optGND.text = '⏚ GND (Ref)';
    select.appendChild(optGND);

    cards.forEach((card, index) => {
        const meshNum = index + 1;
        if (String(meshNum) !== String(myOwnerId)) {
            const opt = document.createElement('option');
            opt.value = meshNum;
            opt.text = `Malha ${meshNum}`;
            select.appendChild(opt);
        }
    });

    if ([...select.options].some(o => o.value === currentSelection)) {
        select.value = currentSelection;
    } else {
        select.value = '0';
    }
  });

  cards.forEach((card, index) => {
      card.querySelector('h3').innerText = `Malha ${index + 1}`;
      const selects = card.querySelectorAll('.mesh-selector');
      selects.forEach(s => s.dataset.ownerId = index + 1);
  });
}

function addMalha() {
  malhaCount++;
  const card = document.createElement('div');
  card.className = 'malha panel';

  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Malha</h3>
      <button type="button" class="btn ghost" data-action="remove">❌ Remover</button>
    </div>
    
    <div class="muted">Resistores (Ω)</div>
    <div class="res-container"></div>
    <div style="margin-top:6px; margin-bottom:10px;">
      <button type="button" class="btn ghost" data-action="addRes">+ Resistor</button>
    </div>

    <div class="muted">Fontes de Tensão (V)</div>
    <div class="vol-container"></div>
    <div style="margin-top:6px;">
      <button type="button" class="btn ghost" data-action="addVolt">+ Fonte</button>
    </div>
  `;

  malhasContainer.appendChild(card);

  const currentId = Array.from(malhasContainer.children).indexOf(card) + 1;
  addRes(card.querySelector('.res-container'), currentId);
  addVolt(card.querySelector('.vol-container'), currentId);
  updateMeshDropdowns();

  card.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'remove') {
        card.remove();
        updateMeshDropdowns();
    } else if (action === 'addRes') {
        const nextId = Array.from(malhasContainer.children).indexOf(card) + 1;
        addRes(card.querySelector('.res-container'), nextId);
    } else if (action === 'addVolt') {
        const nextId = Array.from(malhasContainer.children).indexOf(card) + 1;
        addVolt(card.querySelector('.vol-container'), nextId);
    }
  });
}

function addRes(container, ownerId) {
  const div = document.createElement('div');
  div.className = 'field-row';
  div.innerHTML = `
    <input type="number" step="0.01" class="res-input" placeholder="Valor (Ω)" required>
    <select class="mesh-selector" data-owner-id="${ownerId}">
        <option value="0">⏚ GND (Ref)</option>
    </select>
    <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>
  `;
  container.appendChild(div);
  updateMeshDropdowns();
}

function addVolt(container, ownerId) {
  const div = document.createElement('div');
  div.className = 'field-row';
  div.innerHTML = `
    <input type="number" step="0.01" class="vol-input" placeholder="Valor (V)" required>
    <select class="mesh-selector" data-owner-id="${ownerId}">
        <option value="0">Pertence à Malha</option>
    </select>
    <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>
  `;
  container.appendChild(div);
  updateMeshDropdowns();
}

/* ==========================================================================
   SISTEMA COGNITIVO PARA CORRENTE ALTERNADA (CA)
   ========================================================================== */

function switchMode(mode) {
    currentMode = mode;
    const tabCcBtn = document.getElementById('tabCcBtn');
    const tabCaBtn = document.getElementById('tabCaBtn');
    const contentCc = document.getElementById('contentCc');
    const contentCa = document.getElementById('contentCa');
    const bibCc = document.getElementById('bibliotecaCcGroup');
    const bibCa = document.getElementById('bibliotecaCaGroup');

    if (resultArea) resultArea.style.display = 'none';

    if (mode === 'CC') {
        if(tabCcBtn) tabCcBtn.classList.add('active');
        if(tabCaBtn) tabCaBtn.classList.remove('active');
        if(contentCc) contentCc.classList.add('active');
        if(contentCa) contentCa.classList.remove('active');
        if(bibCc) bibCc.style.display = 'block';
        if(bibCa) bibCa.style.display = 'none';
    } else {
        if(tabCcBtn) tabCcBtn.classList.remove('active');
        if(tabCaBtn) tabCaBtn.classList.add('active');
        if(contentCc) contentCc.classList.remove('active');
        if(contentCa) contentCa.classList.add('active');
        if(bibCc) bibCc.style.display = 'none';
        if(bibCa) bibCa.style.display = 'block';

        if (malhasContainerCa && malhasContainerCa.children.length === 0) {
            addMalhaCa();
            addMalhaCa();
        }
    }
}

function updateMeshDropdownsCa() {
    const allSelects = document.querySelectorAll('#malhasContainerCa .mesh-selector');
    const cards = Array.from(document.querySelectorAll('#malhasContainerCa .malha.panel'));

    allSelects.forEach(select => {
        const currentSelection = select.value;
        const myOwnerId = select.dataset.ownerId;

        select.innerHTML = '';
        const optGND = document.createElement('option');
        optGND.value = '0';
        optGND.text = '⏚ GND (Ref)';
        select.appendChild(optGND);

        cards.forEach((card, index) => {
            const meshNum = index + 1;
            if (String(meshNum) !== String(myOwnerId)) {
                const opt = document.createElement('option');
                opt.value = meshNum;
                opt.text = `Malha CA ${meshNum}`;
                select.appendChild(opt);
            }
        });

        if ([...select.options].some(o => o.value === currentSelection)) {
            select.value = currentSelection;
        } else {
            select.value = '0';
        }
    });

    cards.forEach((card, index) => {
        card.querySelector('h3').innerText = `Malha CA ${index + 1}`;
        const selects = card.querySelectorAll('.mesh-selector');
        selects.forEach(s => s.dataset.ownerId = index + 1);
    });
}

function addMalhaCa() {
    malhaCaCount++;
    const card = document.createElement('div');
    card.className = 'malha panel';

    card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Malha CA</h3>
      <button type="button" class="btn ghost" data-action="removeCa">❌ Remover</button>
    </div>
    
    <div class="muted">Impedâncias Complexas (Z)</div>
    <div class="z-container"></div>
    <div style="margin-top:6px; margin-bottom:10px;">
      <button type="button" class="btn ghost" data-action="addZ">+ Impedância</button>
    </div>

    <div class="muted">Fontes de Tensão Fasoriais (V)</div>
    <div class="v-fasor-container"></div>
    <div style="margin-top:6px;">
      <button type="button" class="btn ghost" data-action="addVFasor">+ Fonte Fasorial</button>
    </div>
  `;

    malhasContainerCa.appendChild(card);

    const currentId = Array.from(malhasContainerCa.children).indexOf(card) + 1;
    addZ(card.querySelector('.z-container'), currentId);
    addVFasor(card.querySelector('.v-fasor-container'), currentId);
    updateMeshDropdownsCa();

    card.addEventListener('click', (ev) => {
        const btn = ev.target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'removeCa') {
            card.remove();
            updateMeshDropdownsCa();
        } else if (action === 'addZ') {
            const nextId = Array.from(malhasContainerCa.children).indexOf(card) + 1;
            addZ(card.querySelector('.z-container'), nextId);
        } else if (action === 'addVFasor') {
            const nextId = Array.from(malhasContainerCa.children).indexOf(card) + 1;
            addVFasor(card.querySelector('.v-fasor-container'), nextId);
        }
    });
}

function addZ(container, ownerId) {
    const div = document.createElement('div');
    div.className = 'field-row';
    div.innerHTML = `
    <div class="complex-input-group">
        <input type="number" step="0.01" class="z-mod-input" placeholder="Módulo" required>
        <span>∠</span>
        <input type="number" step="0.01" class="z-ang-input" placeholder="Graus (°)" value="0" required>
    </div>
    <select class="mesh-selector" data-owner-id="${ownerId}">
        <option value="0">⏚ GND (Ref)</option>
    </select>
    <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>
  `;
    container.appendChild(div);
    updateMeshDropdownsCa();
}

function addVFasor(container, ownerId) {
    const div = document.createElement('div');
    div.className = 'field-row';
    div.innerHTML = `
    <div class="complex-input-group">
        <input type="number" step="0.01" class="v-mod-input" placeholder="Módulo" required>
        <span>∠</span>
        <input type="number" step="0.01" class="v-ang-input" placeholder="Graus (°)" value="0" required>
    </div>
    <select class="mesh-selector" data-owner-id="${ownerId}">
        <option value="0">Pertence à Malha</option>
    </select>
    <button type="button" class="btn ghost" onclick="this.parentElement.remove()">🗑️</button>
  `;
    container.appendChild(div);
    updateMeshDropdownsCa();
}

function handleCaSubmit(e) {
    e.preventDefault();
    const engineAc = new CircuitEngineAC();
    const cards = Array.from(document.querySelectorAll('#malhasContainerCa .malha.panel'));

    if (cards.length === 0) { alert("Adicione pelo menos uma malha CA."); return; }

    cards.forEach(() => engineAc.addMesh());

    try {
        cards.forEach((card, index) => {
            const meshId = index + 1;

            const zRows = card.querySelectorAll('.z-container .field-row');
            zRows.forEach(row => {
                const mod = parseFloat(row.querySelector('.z-mod-input').value);
                const ang = parseFloat(row.querySelector('.z-ang-input').value);
                const neighbor = parseInt(row.querySelector('.mesh-selector').value);

                if (isNaN(mod) || isNaN(ang)) throw new Error(`Valor ou ângulo inválido em Impedância na Malha CA ${meshId}`);
                engineAc.addImpedance(mod, ang, meshId, neighbor);
            });

            const vRows = card.querySelectorAll('.v-fasor-container .field-row');
            vRows.forEach(row => {
                const mod = parseFloat(row.querySelector('.v-mod-input').value);
                const ang = parseFloat(row.querySelector('.v-ang-input').value);
                const neighbor = parseInt(row.querySelector('.mesh-selector').value);

                if (isNaN(mod) || isNaN(ang)) throw new Error(`Valor ou ângulo inválido em Fonte Fasorial na Malha CA ${meshId}`);
                engineAc.addVoltageSourceFasor(mod, ang, meshId, neighbor);
            });
        });

        const solutionAC = engineAc.solve();
        console.log("Sistema CA Resolvido com Sucesso!", solutionAC);

        lastCalculatedSolution = solutionAC;
        renderResultsAC(solutionAC, engineAc);

    } catch (err) {
        alert("Erro no cálculo de CA: " + err.message);
        console.error(err);
    }
}

function renderResultsAC(sol, engineAc) {
    if(!resultsInner || !resultArea) return;

    resultsInner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; color:var(--primary);">Resultados Analíticos de CA</h3>
            <button id="btnPrintAc" class="btn" style="background:var(--primary); color:#000; padding:6px 12px; border-radius:8px; font-weight:bold; cursor:pointer; border:none;">🖨️ Imprimir Relatório</button>
        </div>
    `;

    // --- NOVA TABELA COM A COLUNA DE TENSÃO INCLUÍDA ---
    let tableHtml = `
        <table class="result-table">
            <thead>
                <tr>
                    <th>Malha CA</th>
                    <th>Tensão Ref. (V)</th>
                    <th>Corrente Fasorial (I)</th>
                    <th>Formato Retangular (I)</th>
                </tr>
            </thead>
            <tbody>
    `;

    sol.currents.forEach((obj, i) => {
        // Dados de Corrente
        const modI = obj.polar.mod.toFixed(4);
        const angI = obj.polar.ang.toFixed(2);

        const realI = obj.rectangular.re.toFixed(4);
        const imagI = obj.rectangular.im.toFixed(4);
        const sinalImag = imagI >= 0 ? `+ j${imagI}` : `- j${Math.abs(imagI)}`;

        // Extração e processamento da Tensão
        const vComplex = sol.vector[i];
        const vPolar = vComplex.toPolar();
        let vAng = (vPolar.phi * 180) / Math.PI;
        if (vAng > 180) vAng -= 360;
        if (vAng <= -180) vAng += 360;

        const modV = vPolar.r.toFixed(2);
        const angV = vAng.toFixed(2);

        tableHtml += `
            <tr>
                <td><strong>Malha CA ${i + 1}</strong></td>
                <td style="color:#ffeb3b; font-weight:bold;">${modV} ∠ ${angV}° V</td>
                <td style="color:var(--primary); font-weight:bold;">${modI} ∠ ${angI}° A</td>
                <td style="opacity:0.85; font-family:monospace;">${realI} ${sinalImag} A</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table><br>`;

    // --- NOVA SECÇÃO: QUEDA DE TENSÃO NOS COMPONENTES INDIVIDUAIS ---
    tableHtml += `<h4 style="color:var(--primary); margin: 15px 0 10px 0;">📉 Queda de Tensão nos Componentes Individuais (V = Z · I)</h4>`;

    const cards = Array.from(document.querySelectorAll('#malhasContainerCa .malha.panel'));

    cards.forEach((card, index) => {
        tableHtml += `
            <div style="margin-bottom:15px; padding:12px; background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid var(--secondary);">
                <strong style="color:var(--text); display:block; margin-bottom:8px;">Componentes da Malha CA ${index + 1}:</strong>
                <ul style="margin:0; padding-left:20px; font-family:monospace; font-size:0.9rem; list-style-type: square;">
        `;

        const I_rect = sol.currents[index].rectangular;
        const I_complex = math.complex(I_rect.re, I_rect.im);

        const zRows = card.querySelectorAll('.z-container .field-row');
        zRows.forEach((row, zIndex) => {
            const modZ = parseFloat(row.querySelector('.z-mod-input').value);
            const angZDeg = parseFloat(row.querySelector('.z-ang-input').value);

            if (!isNaN(modZ) && !isNaN(angZDeg)) {
                const angZRad = (angZDeg * Math.PI) / 180;
                const Z_complex = math.complex({ r: modZ, phi: angZRad });

                const V_comp_complex = math.multiply(Z_complex, I_complex);
                const vCompPolar = V_comp_complex.toPolar();
                let vCompAng = (vCompPolar.phi * 180) / Math.PI;
                if (vCompAng > 180) vCompAng -= 360;
                if (vCompAng <= -180) vCompAng += 360;

                let tipoComponente = "Impedância Z";
                if (Math.abs(angZDeg) < 1) tipoComponente = "Resistor R";
                else if (Math.abs(angZDeg - 90) < 1) tipoComponente = "Indutor L";
                else if (Math.abs(angZDeg + 90) < 1) tipoComponente = "Capacitor C";

                tableHtml += `
                    <li style="margin-bottom: 4px;">
                        <span style="color:#9fbfc6;">${tipoComponente} ${zIndex + 1} (${modZ} ∠ ${angZDeg}° Ω):</span> 
                        <strong style="color:#00ff9d;">${vCompPolar.r.toFixed(2)} ∠ ${vCompAng.toFixed(2)}° V</strong>
                    </li>
                `;
            }
        });

        tableHtml += `</ul></div>`;
    });
    // --- FIM DA NOVA SECÇÃO ---

    tableHtml += `<h4 style="color:var(--primary); margin: 15px 0 10px 0;">📐 Triângulo de Potências por Malha</h4>`;

    let totalP = 0;
    let totalQ = 0;

    sol.currents.forEach((obj, i) => {
        const V_fasor = sol.vector[i];
        const I_rect = obj.rectangular;
        const I_conj = math.conj(I_rect);
        const S = math.multiply(V_fasor, I_conj);

        const P = S.re;
        const Q = S.im;
        const S_mod = math.abs(S);

        totalP += P;
        totalQ += Q;

        const FP = S_mod > 1e-6 ? P / S_mod : 1;
        const tipoFP = Q > 1e-4 ? "Indutivo (Atrasado)" : (Q < -1e-4 ? "Capacitivo (Adiantado)" : "Resistivo Puro");

        tableHtml += `
            <div class="result-power-box" style="margin-bottom:15px; padding:12px; background:rgba(0,0,0,0.2); border-radius:10px; border:1px solid var(--secondary);">
                <strong style="color:var(--text); display:block; margin-bottom:8px;">Malha CA ${i + 1}:</strong>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.88rem; font-family:monospace;">
                    <div>Potência Ativa (P): <span style="color:#00ff9d;" class="p-active-val">${P.toFixed(4)} W</span></div>
                    <div>Potência Reativa (Q): <span style="color:#ffeb3b;" class="p-reactive-val">${Q.toFixed(4)} var</span></div>
                    <div>Potência Aparente (|S|): <span style="color:var(--primary);" class="p-apparent-val">${S_mod.toFixed(4)} VA</span></div>
                    <div>Fator de Potência (FP): <span style="color:var(--text); font-weight:bold;" class="fp-val">${FP.toFixed(3)} (${tipoFP})</span></div>
                </div>
            </div>
        `;
    });

    const totalS_mod = Math.sqrt(totalP * totalP + totalQ * totalQ);
    const totalFP = totalS_mod > 1e-6 ? Math.abs(totalP) / totalS_mod : 1;
    const tipoTotalFP = totalQ > 1e-4 ? "Indutivo (Atrasado)" : (totalQ < -1e-4 ? "Capacitivo (Adiantado)" : "Resistivo Puro");

    tableHtml += `
        <div style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.4); border-radius:10px; border:1px solid var(--primary); box-shadow: 0 0 15px rgba(0,229,255,0.08);">
            <strong style="color:var(--primary); display:block; margin-bottom:12px; font-size:1.1rem; text-transform:uppercase; letter-spacing:0.5px;">🌐 Balanço Global de Potência (Sistema CA)</strong>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.95rem; font-family:monospace;">
                <div>P Total (Ativa): <span style="color:#00ff9d;">${totalP.toFixed(4)} W</span></div>
                <div>Q Total (Reativa): <span style="color:#ffeb3b;">${totalQ.toFixed(4)} var</span></div>
                <div>S Total (Aparente): <span style="color:var(--text); font-weight:bold;">${totalS_mod.toFixed(4)} VA</span></div>
                <div>FP Global: <span style="color:var(--text); font-weight:bold;">${totalFP.toFixed(3)} (${tipoTotalFP})</span></div>
            </div>
            <div style="font-size:0.8rem; opacity:0.7; margin-top:12px; border-top: 1px dashed rgba(255,255,255,0.15); padding-top:10px;">
                *Somatório fasorial das potências complexas fornecidas/dissipadas pelo sistema (S = P + jQ).
            </div>
        </div>
    `;

    resultsInner.innerHTML += tableHtml;

    const btnExplicacao = document.createElement('button');
    btnExplicacao.className = 'btn ghost';
    btnExplicacao.style.marginTop = '15px';
    btnExplicacao.style.width = '100%';
    btnExplicacao.innerText = '👁️ Ver Explicação Matemática CA';
    resultsInner.appendChild(btnExplicacao);

    const detailsAc = document.createElement('div');
    detailsAc.id = 'eqDetailsAc';
    detailsAc.style.display = 'none';
    detailsAc.style.marginTop = '15px';
    detailsAc.style.padding = '15px';
    detailsAc.style.background = 'rgba(0,0,0,0.3)';
    detailsAc.style.borderRadius = '12px';

    let htmlExplicacao = renderEquationsAC_HTML(sol.matrix, sol.vector);
    htmlExplicacao += generateDidacticExplanationAC(sol.matrix, sol.vector);
    detailsAc.innerHTML = htmlExplicacao;
    resultsInner.appendChild(detailsAc);

    btnExplicacao.onclick = () => {
        if(detailsAc.style.display === 'none') { detailsAc.style.display = 'block'; btnExplicacao.innerText = '🙈 Ocultar Explicação CA'; }
        else { detailsAc.style.display = 'none'; btnExplicacao.innerText = '👁️ Ver Explicação Matemática CA'; }
    };

    const printBtn = document.getElementById('btnPrintAc');
    if(printBtn) {
        printBtn.onclick = () => {
            renderAllACCharts(sol);
            setTimeout(() => window.print(), 500);
        };
    }

    // INSERÇÃO SEGURA: Oculta o gráfico CC e exibe a grade CA
    document.getElementById('ccChartContainer').style.display = 'none';
    const acGrid = document.getElementById('acChartsGrid');
    if(acGrid) acGrid.style.display = 'grid';

    // Chama o novo motor quádruplo de gráficos CA
    if(typeof renderAllACCharts === "function") renderAllACCharts(sol);

    resultArea.style.display = 'block';
    resultArea.scrollIntoView({ behavior: 'smooth' });
}

function renderEquationsAC_HTML(M, b) {
    let html = '<div style="font-family:monospace; color:var(--text); font-size:0.9rem;">';
    html += '<div style="margin-bottom:8px; color:var(--secondary); font-weight:bold;">Sistema Linear Complexo: [Z] · [I] = [V]</div>';

    M.forEach((row, i) => {
        let lineStr = "";
        row.forEach((val, j) => {
            const real = val.re;
            const imag = val.im;

            let compStr = "";
            if (Math.abs(real) > 1e-4 || Math.abs(imag) < 1e-4) {
                compStr += real.toFixed(2);
            }
            if (Math.abs(imag) > 1e-4) {
                const sinalJ = imag >= 0 ? (real !== 0 ? " + j" : "j") : " - j";
                compStr += `${sinalJ}${Math.abs(imag).toFixed(2)}`;
            }
            if (compStr === "") compStr = "0";

            let termSign = " + ";
            if (j === 0) termSign = "";

            lineStr += `${termSign}(${compStr})·I<sub>${j+1}</sub> `;
        });

        const polarB = b[i].toPolar();
        let angB = (polarB.phi * 180) / Math.PI;
        if (angB > 180) angB -= 360;
        if (angB <= -180) angB += 360;

        lineStr += `= ${polarB.r.toFixed(2)} ∠ ${angB.toFixed(1)}° V`;
        html += `<div style="padding:4px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">${lineStr}</div>`;
    });
    html += '</div>';
    return html;
}

function generateDidacticExplanationAC(M, b) {
    let html = '<div style="margin-top:20px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">';
    html += '<h4 style="color:var(--primary); margin:0 0 10px 0;">📝 Passo a Passo (Inspeção CA)</h4>';

    M.forEach((row, i) => {
        const meshNum = i + 1;
        const diagonalZ = row[i];
        const polarZ = diagonalZ.toPolar();
        let angZ = (polarZ.phi * 180) / Math.PI;
        if (angZ > 180) angZ -= 360;

        const voltage = b[i];
        const polarV = voltage.toPolar();
        let angV = (polarV.phi * 180) / Math.PI;
        if (angV > 180) angV -= 360;

        html += `<div style="margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">`;
        html += `<strong style="color:var(--text); font-size:1rem;">Análise da Malha CA ${meshNum}:</strong>`;
        html += `<ul style="margin:5px 0 0 20px; color:#9fbfc6; font-size:0.9rem; line-height:1.5;">`;

        const sinalJ = diagonalZ.im >= 0 ? "+ j" : "- j";
        html += `<li><strong>Impedância Própria (Z<sub>${meshNum}${meshNum}</sub>):</strong> A soma de todas as impedâncias que pertencem a esta malha é <strong>${diagonalZ.re.toFixed(2)} ${sinalJ}${Math.abs(diagonalZ.im).toFixed(2)} Ω</strong> (Fasor: <strong>${polarZ.r.toFixed(2)} ∠ ${angZ.toFixed(1)}° Ω</strong>).</li>`;

        let hasNeighbors = false;
        row.forEach((val, j) => {
            if (i !== j && math.abs(val) > 1e-4) {
                hasNeighbors = true;
                const sinalMut = val.im >= 0 ? "+ j" : "- j";
                html += `<li><strong>Conexão com Malha CA ${j+1} (Z<sub>${meshNum}${j+1}</sub>):</strong> Existe uma impedância compartilhada de <strong>${Math.abs(val.re).toFixed(2)} ${sinalMut}${Math.abs(val.im).toFixed(2)} Ω</strong>. (Entra subtraindo no sistema).</li>`;
            }
        });

        if (!hasNeighbors) {
            html += `<li><em>Esta malha não compartilha impedâncias com nenhuma outra malha.</em></li>`;
        }

        html += `<li><strong>Tensão Resultante (V<sub>${meshNum}</sub>):</strong> A soma fasorial das fontes nesta malha é <strong>${polarV.r.toFixed(2)} ∠ ${angV.toFixed(1)}° V</strong>.</li>`;

        html += `</ul></div>`;
    });
    html += '</div>';
    return html;
}


/* ==========================================================================
   NOVO MOTOR DE VISUALIZAÇÃO CA (4 GRÁFICOS ESPECIALIZADOS)
   ========================================================================== */
function renderAllACCharts(sol) {
    // 1. Destruir instâncias anteriores para evitar vazamentos e sobreposições
    if (currentFasorChartInst) currentFasorChartInst.destroy();
    if (voltageFasorChartInst) voltageFasorChartInst.destroy();
    if (sineWaveChartInst) sineWaveChartInst.destroy();
    if (powerTriangleChartInst) powerTriangleChartInst.destroy();

    const gridLineColor = isPrintingMode ? '#d0d0d0' : 'rgba(255, 255, 255, 0.08)';
    const textLabelColor = isPrintingMode ? '#000000' : '#ffffff';
    const axisLineColor = isPrintingMode ? '#000000' : 'rgba(255, 255, 255, 0.4)';
    const colors = ['#00e5ff', '#00ff9d', '#ff8fa3', '#f9c74f', '#9b5de5'];

    // Plugins Locais Seguros
    const vectorArrowsPlugin = {
        id: 'vectorArrows',
        afterDatasetsDraw: (chart) => {
            const { ctx, scales: { x, y } } = chart;
            ctx.save();
            chart.data.datasets.forEach((dataset) => {
                if (dataset.data.length < 2 || !dataset.showLine) return;
                const p0 = dataset.data[0];
                const p1 = dataset.data[dataset.data.length - 1];

                const x0 = x.getPixelForValue(p0.x);
                const y0 = y.getPixelForValue(p0.y);
                const x1 = x.getPixelForValue(p1.x);
                const y1 = y.getPixelForValue(p1.y);

                if (Math.abs(x1 - x0) < 1 && Math.abs(y1 - y0) < 1) return;

                const angle = Math.atan2(y1 - y0, x1 - x0);
                const arrowLength = 12;

                ctx.fillStyle = dataset.borderColor;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 - arrowLength * Math.cos(angle - Math.PI / 6), y1 - arrowLength * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(x1 - arrowLength * Math.cos(angle + Math.PI / 6), y1 - arrowLength * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
            });
            ctx.restore();
        }
    };

    const polarAxisLayoutPlugin = {
        id: 'polarAxisLayout',
        afterDraw: (chart) => {
            const { ctx, chartArea: { left, top, right, bottom }, scales: { x, y } } = chart;
            const centerX = x.getPixelForValue(0);
            const centerY = y.getPixelForValue(0);

            ctx.save();
            ctx.strokeStyle = axisLineColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(left, centerY); ctx.lineTo(right, centerY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(centerX, top); ctx.lineTo(centerX, bottom); ctx.stroke();

            ctx.fillStyle = textLabelColor;
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
            ctx.fillText('Real (R)', right - 5, centerY - 6);
            ctx.save();
            ctx.translate(centerX - 8, top + 10);
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText('Imag (jX)', 0, 0);
            ctx.restore();
            ctx.restore();
        }
    };

    // --- GRÁFICO 1: CORRENTES ---
    const ctxCurrent = document.getElementById('currentFasorChart')?.getContext('2d');
    if (ctxCurrent) {
        let maxI = 1;
        const dataI = sol.currents.map((obj, i) => {
            if (obj.polar.mod > maxI) maxI = obj.polar.mod;
            return {
                label: `I${i+1} (${obj.polar.mod.toFixed(2)}A ∠ ${obj.polar.ang.toFixed(1)}°)`,
                data: [{ x: 0, y: 0 }, { x: obj.rectangular.re, y: obj.rectangular.im }],
                borderColor: colors[i % colors.length],
                backgroundColor: colors[i % colors.length],
                borderWidth: 3, showLine: true, pointRadius: [0, 0]
            };
        });

        const limitI = maxI * 1.2;
        currentFasorChartInst = new Chart(ctxCurrent, {
            type: 'scatter',
            data: { datasets: dataI },
            options: getPolarChartOptions(limitI, gridLineColor, textLabelColor, 'Fasores de Corrente (A)'),
            plugins: [vectorArrowsPlugin, polarAxisLayoutPlugin]
        });
    }

    // --- GRÁFICO 2: TENSÕES ---
    const ctxVoltage = document.getElementById('voltageFasorChart')?.getContext('2d');
    if (ctxVoltage) {
        let maxV = 1;
        const dataV = [];

        // 1. Adiciona os Fasores das Fontes de Tensão (Linha Tracejada Amarela)
        sol.vector.forEach((v, i) => {
            const polar = v.toPolar();
            const ang = (polar.phi * 180) / Math.PI;
            if (polar.r > maxV) maxV = polar.r;
            dataV.push({
                label: `Fonte V${i+1} (${polar.r.toFixed(2)}V ∠ ${ang.toFixed(1)}°)`,
                data: [{ x: 0, y: 0 }, { x: v.re, y: v.im }],
                borderColor: isPrintingMode ? '#555' : 'rgba(255, 235, 59, 0.9)',
                borderWidth: 2, borderDash: [5, 5], showLine: true, pointRadius: [0, 0]
            });
        });

        // 2. Adiciona os Fasores das Quedas de Tensão nos Componentes (Linhas Sólidas Coloridas)
        const cards = Array.from(document.querySelectorAll('#malhasContainerCa .malha.panel'));
        const compColors = ['#ff8fa3', '#00e5ff', '#9b5de5', '#00ff9d', '#ff9f1c'];
        let compCounter = 0;

        cards.forEach((card, index) => {
            const I_rect = sol.currents[index].rectangular;
            const I_complex = math.complex(I_rect.re, I_rect.im);
            const zRows = card.querySelectorAll('.z-container .field-row');

            zRows.forEach((row, zIndex) => {
                const modZ = parseFloat(row.querySelector('.z-mod-input').value);
                const angZDeg = parseFloat(row.querySelector('.z-ang-input').value);

                if (!isNaN(modZ) && !isNaN(angZDeg)) {
                    const angZRad = (angZDeg * Math.PI) / 180;
                    const Z_complex = math.complex({ r: modZ, phi: angZRad });

                    // Cálculo V = Z * I
                    const V_comp = math.multiply(Z_complex, I_complex);
                    const vCompPolar = V_comp.toPolar();
                    let vCompAng = (vCompPolar.phi * 180) / Math.PI;
                    if (vCompAng > 180) vCompAng -= 360;
                    if (vCompAng <= -180) vCompAng += 360;

                    if (vCompPolar.r > maxV) maxV = vCompPolar.r;

                    // Identifica o componente para a legenda
                    let tipoComponente = "Z";
                    if (Math.abs(angZDeg) < 1) tipoComponente = "R";
                    else if (Math.abs(angZDeg - 90) < 1) tipoComponente = "L";
                    else if (Math.abs(angZDeg + 90) < 1) tipoComponente = "C";

                    dataV.push({
                        label: `V_${tipoComponente}${zIndex + 1} (Malha ${index+1}): ${vCompPolar.r.toFixed(2)}V ∠ ${vCompAng.toFixed(1)}°`,
                        data: [{ x: 0, y: 0 }, { x: V_comp.re, y: V_comp.im }],
                        borderColor: compColors[compCounter % compColors.length],
                        borderWidth: 2, showLine: true, pointRadius: [0, 0]
                    });
                    compCounter++;
                }
            });
        });

        const limitV = maxV * 1.2;
        voltageFasorChartInst = new Chart(ctxVoltage, {
            type: 'scatter',
            data: { datasets: dataV },
            options: getPolarChartOptions(limitV, gridLineColor, textLabelColor, 'Fasores de Tensão (V)'),
            plugins: [vectorArrowsPlugin, polarAxisLayoutPlugin]
        });
    }

    // --- GRÁFICO 3: DOMÍNIO DO TEMPO ---
    const ctxSine = document.getElementById('sineWaveChart')?.getContext('2d');
    if (ctxSine) {
        const xValues = [];
        for (let t = 0; t <= 360; t += 5) xValues.push(t);

        const datasetsSine = sol.currents.map((obj, i) => {
            const I_max = obj.polar.mod * Math.sqrt(2);
            const angRad = (obj.polar.ang * Math.PI) / 180;

            const yValues = xValues.map(deg => {
                const omegaT = (deg * Math.PI) / 180;
                return I_max * Math.sin(omegaT + angRad);
            });

            return {
                label: `i${i+1}(t)`,
                data: yValues,
                borderColor: colors[i % colors.length],
                borderWidth: 2, tension: 0.4, pointRadius: 0
            };
        });

        sineWaveChartInst = new Chart(ctxSine, {
            type: 'line',
            data: { labels: xValues, datasets: datasetsSine },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: {
                        title: { display: true, text: 'ωt (Graus)', color: textLabelColor },
                        grid: { color: gridLineColor }, ticks: { color: textLabelColor, maxTicksLimit: 8 }
                    },
                    y: {
                        title: { display: true, text: 'Amplitude (A)', color: textLabelColor },
                        grid: { color: axisLineColor }, ticks: { color: textLabelColor }
                    }
                },
                plugins: {
                    title: { display: true, text: 'Domínio do Tempo', color: textLabelColor, font: {family:'monospace'} },
                    legend: { position: 'top', labels: { color: textLabelColor, font: {family: 'monospace'} } }
                }
            }
        });
    }

    // --- GRÁFICO 4: TRIÂNGULO DE POTÊNCIA ---
    const ctxPower = document.getElementById('powerTriangleChart')?.getContext('2d');
    if (ctxPower) {
        let P_tot = 0, Q_tot = 0;
        sol.currents.forEach((obj, i) => {
            const S = math.multiply(sol.vector[i], math.conj(obj.rectangular));
            P_tot += S.re; Q_tot += S.im;
        });

        const datasetsPower = [
            {
                label: `Ativa (P) = ${P_tot.toFixed(1)} W`,
                data: [{x: 0, y: 0}, {x: P_tot, y: 0}],
                borderColor: '#00ff9d', borderWidth: 4, showLine: true, pointRadius: [0, 0]
            },
            {
                label: `Reativa (Q) = ${Q_tot.toFixed(1)} var`,
                data: [{x: P_tot, y: 0}, {x: P_tot, y: Q_tot}],
                borderColor: '#f9c74f', borderWidth: 4, showLine: true, pointRadius: [0, 0]
            },
            {
                label: `Aparente (S)`,
                data: [{x: 0, y: 0}, {x: P_tot, y: Q_tot}],
                borderColor: '#00e5ff', borderWidth: 2, borderDash: [5,5], showLine: true, pointRadius: [0, 0]
            }
        ];

        const maxVal = Math.max(Math.abs(P_tot), Math.abs(Q_tot)) * 1.2;

        powerTriangleChartInst = new Chart(ctxPower, {
            type: 'scatter',
            data: { datasets: datasetsPower },
            options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                    x: { min: P_tot < 0 ? -maxVal : -maxVal/4, max: maxVal, grid: { color: gridLineColor }, ticks: { color: textLabelColor } },
                    y: { min: Q_tot < 0 ? -maxVal : -maxVal/4, max: maxVal, grid: { color: gridLineColor }, ticks: { color: textLabelColor } }
                },
                plugins: {
                    title: { display: true, text: 'Balanço de Potência Global', color: textLabelColor, font: {family:'monospace'} },
                    legend: { position: 'top', labels: { color: textLabelColor } },
                    tooltip: { callbacks: { label: (ctx) => ctx.dataset.label } }
                }
            },
            plugins: [vectorArrowsPlugin]
        });
    }
}

function getPolarChartOptions(limit, gridColor, textColor, titleText) {
    return {
        responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
        scales: {
            x: { type: 'linear', position: 'center', min: -limit, max: limit, grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor } },
            y: { type: 'linear', position: 'center', min: -limit, max: limit, grid: { color: gridColor, drawBorder: false }, ticks: { color: textColor } }
        },
        plugins: {
            title: { display: true, text: titleText, color: textColor, font: {family:'monospace'}, padding: { bottom: 15 } },
            legend: { position: 'top', labels: { color: textColor, font: {family: 'monospace', size: 11} } }
        }
    };
}

/* ==========================================================================
   SISTEMA DE RENDERIZAÇÃO CC E INTERFACE GLOBAL (MANTIDO)
   ========================================================================== */

function toggleMascot() {
  mascotActive = !mascotActive;
  if(mascotContainer) {
      mascotContainer.style.display = mascotActive ? 'flex' : 'none';
  }
}

function handleSubmit(e) {
  e.preventDefault();
  const engine = new CircuitEngine();
  const cards = Array.from(document.querySelectorAll('#malhasContainer .malha.panel'));

  if (cards.length === 0) { alert("Adicione pelo menos uma malha."); return; }

  cards.forEach(() => engine.addMesh());

  try {
      cards.forEach((card, index) => {
        const meshId = index + 1;
        const resRows = card.querySelectorAll('.res-container .field-row');
        resRows.forEach(row => {
            const val = parseFloat(row.querySelector('.res-input').value);
            const neighbor = parseInt(row.querySelector('.mesh-selector').value);
            if (isNaN(val)) throw new Error(`Valor inválido em Resistor na Malha ${meshId}`);
            engine.addResistor(val, meshId, neighbor);
        });

        const volRows = card.querySelectorAll('.vol-container .field-row');
        volRows.forEach(row => {
            const val = parseFloat(row.querySelector('.vol-input').value);
            const neighbor = parseInt(row.querySelector('.mesh-selector').value);
            if (isNaN(val)) throw new Error(`Valor inválido em Fonte na Malha ${meshId}`);
            engine.addVoltageSource(val, meshId, neighbor);
        });
      });

      const solution = engine.solve();
      renderResults(solution);

  } catch (err) {
    alert("Erro: " + err.message);
    console.error(err);
  }
}

function renderResults(sol) {
    if(!resultsInner || !resultArea) return;

    resultsInner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0;">Resultados Analíticos</h3>
            <button id="btnPrint" class="btn ghost" title="Salvar como PDF" style="padding:5px 10px; font-size:0.8rem;">🖨️ Imprimir</button>
        </div>
    `;

    let tableHtml = `
        <table class="result-table">
            <thead>
                <tr>
                    <th>Malha</th>
                    <th>Corrente (I)</th>
                    <th>Sentido</th>
                </tr>
            </thead>
            <tbody>
    `;

    let totalPowerSource = 0;

    sol.currents.forEach((I, i) => {
        const sentido = I >= 0 ? "Horário (↻)" : "Anti-horário (↺)";
        const valorFormatado = Math.abs(I).toFixed(5);
        const sinal = I >= 0 ? "+" : "-";

        const voltage = sol.vector[i];
        const power = voltage * I;
        totalPowerSource += power;

        tableHtml += `
            <tr>
                <td><strong>Malha ${i + 1}</strong></td>
                <td style="color:var(--text)">${sinal} ${valorFormatado} A</td>
                <td style="opacity:0.8; font-size:0.85rem;">${sentido}</td>
            </tr>
        `;
    });
    tableHtml += `</tbody></table>`;

    tableHtml += `
        <div style="margin-top:20px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid var(--secondary);">
            <strong style="color:var(--primary); display:block; margin-bottom:5px;">⚡ Balanço de Potência (Malhas)</strong>
            <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                <span>Potência Líquida do Sistema:</span>
                <span style="font-family:monospace; color:${Math.abs(totalPowerSource) < 0.01 ? '#00ff9d' : '#ffeb3b'}">
                    ${Math.abs(totalPowerSource).toFixed(4)} W
                </span>
            </div>
            <div style="font-size:0.75rem; opacity:0.6; margin-top:5px;">
                *Valores próximos de zero indicam equilíbrio (Lei de Tellegen).
            </div>
        </div>
    `;

    resultsInner.innerHTML += tableHtml;

    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    btn.style.marginTop = '20px';
    btn.style.width = '100%';
    btn.innerText = '👁️ Ver Explicação Matemática';
    resultsInner.appendChild(btn);

    const details = document.createElement('div');
    details.id = 'eqDetails';
    details.style.display = 'none';
    details.style.marginTop = '15px';
    details.style.padding = '15px';
    details.style.background = 'rgba(0,0,0,0.3)';
    details.style.borderRadius = '12px';

    let html = renderEquationsHTML(sol.matrix, sol.vector);
    html += generateDidacticExplanation(sol.matrix, sol.vector);
    details.innerHTML = html;
    resultsInner.appendChild(details);

    btn.onclick = () => {
        if(details.style.display === 'none') { details.style.display='block'; btn.innerText='🙈 Ocultar Explicação'; }
        else { details.style.display='none'; btn.innerText='👁️ Ver Explicação Matemática'; }
    };

    const printBtn = document.getElementById('btnPrint');
    if(printBtn) printBtn.onclick = () => window.print();

    if(typeof renderChart === "function") renderChart(sol.currents);

    // INSERÇÃO SEGURA: Garante que apenas o gráfico de CC apareça
    document.getElementById('ccChartContainer').style.display = 'block';
    document.getElementById('acChartsGrid').style.display = 'none';

    resultArea.style.display = 'block';
    resultArea.scrollIntoView({ behavior: 'smooth' });
}

function renderEquationsHTML(M, b) {
    let html = '<div style="font-family:monospace; color:var(--text); font-size:0.9rem;">';
    html += '<div style="margin-bottom:8px; color:var(--secondary); font-weight:bold;">Sistema Linear: [R] · [i] = [V]</div>';
    M.forEach((row, i) => {
        let lineStr = "";
        row.forEach((val, j) => {
            let sign = val >= 0 ? "+" : "-";
            if (j === 0 && val >= 0) sign = "";
            if (j > 0 && val >= 0) sign = "+ ";
            if (val < 0) sign = "- ";
            let absVal = Math.abs(val).toFixed(2);
            lineStr += `${sign}${absVal}·i<sub>${j+1}</sub> `;
        });
        lineStr += `= ${b[i].toFixed(2)} V`;
        html += `<div style="padding:4px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">${lineStr}</div>`;
    });
    html += '</div>';
    return html;
}

function generateDidacticExplanation(M, b) {
    let html = '<div style="margin-top:20px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1);">';
    html += '<h4 style="color:var(--primary); margin:0 0 10px 0;">📝 Passo a Passo (Inspeção)</h4>';

    M.forEach((row, i) => {
        const meshNum = i + 1;
        const diagonalR = row[i];
        const voltage = b[i];

        html += `<div style="margin-bottom:15px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">`;
        html += `<strong style="color:var(--text); font-size:1rem;">Análise da Malha ${meshNum}:</strong>`;
        html += `<ul style="margin:5px 0 0 20px; color:#9fbfc6; font-size:0.9rem; line-height:1.5;">`;

        html += `<li><strong>Resistência Total (R<sub>${meshNum}${meshNum}</sub>):</strong> A soma de todos os resistores que tocam esta malha é <strong>${diagonalR.toFixed(2)} Ω</strong>. (Entra positivo na diagonal).</li>`;

        let hasNeighbors = false;
        row.forEach((val, j) => {
            if (i !== j && Math.abs(val) > 0.001) {
                hasNeighbors = true;
                html += `<li><strong>Conexão com Malha ${j+1}:</strong> Existe um resistor compartilhado de <strong>${Math.abs(val).toFixed(2)} Ω</strong>. (Entra subtraindo na equação).</li>`;
            }
        });

        if (!hasNeighbors) {
            html += `<li><em>Esta malha não compartilha resistores com ninguém (isolada).</em></li>`;
        }

        html += `<li><strong>Tensão Resultante (V<sub>${meshNum}</sub>):</strong> A soma das fontes nesta malha (considerando o sentido) é <strong>${voltage.toFixed(2)} V</strong>.</li>`;

        html += `</ul></div>`;
    });
    html += '</div>';
    return html;
}

function applyFont() {
  if(!fontRange || !fontValue) return;
  const scale = parseInt(fontRange.value, 10) / 100;
  document.documentElement.style.setProperty('--font-scale', scale);
  fontValue.innerText = fontRange.value + '%';
}

function renderChart(currents) {
    const chartEl = document.getElementById('currentChart');
    if(!chartEl) return;
    const ctx = chartEl.getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    const labels = currents.map((_, i) => `Malha ${i + 1}`);
    const data = currents.map(i => Math.abs(i));

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Corrente (Amperes)',
                data: data,
                backgroundColor: 'rgba(0, 229, 255, 0.5)',
                borderColor: '#00e5ff',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#dffaff' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#dffaff' }
                }
            },
            plugins: {
                legend: { labels: { color: '#dffaff' } }
            }
        }
    });
}

// --- INTERCEPTADORES DOS EVENTOS DE IMPRESSÃO VIA SINAL SEGURO ---
window.addEventListener('beforeprint', () => {
    isPrintingMode = true;
    if (currentMode === 'CA' && lastCalculatedSolution) {
        renderAllACCharts(lastCalculatedSolution);
    }
});

window.addEventListener('afterprint', () => {
    isPrintingMode = false;
    if (currentMode === 'CA' && lastCalculatedSolution) {
        renderAllACCharts(lastCalculatedSolution);
    }
});

// --- ASSINATURA DE MAPEAMENTO DO ESCOPO GLOBAL ---
window.switchMode = switchMode;
window.addMalhaCa = addMalhaCa;
window.addMalha = addMalha;
window.loadCircuit = loadCircuit;

window.restoreAll = () => {
    applyPreset('theme');
    if(fontRange) { fontRange.value=100; applyFont(); }
    if(brightRange) { brightRange.value=100; contrastRange.value=100; saturationRange.value=100; }
    setDalton('');
    dyslexicActive=false; document.body.classList.remove('dyslexic');
    mascotActive = true; if(mascotContainer) mascotContainer.style.display='flex';
};
window.applyPreset = applyPreset;
window.toggleSettings = () => { if(settingsPanel) settingsPanel.classList.toggle('show'); };
window.toggleDyslexic = () => { dyslexicActive = !dyslexicActive; document.body.classList.toggle('dyslexic', dyslexicActive); };
window.increaseFont = () => { if(fontRange) { fontRange.value = Math.min(180, +fontRange.value + 10); applyFont(); } };
window.decreaseFont = () => { if(fontRange) { fontRange.value = Math.max(80, +fontRange.value - 10); applyFont(); } };
window.applyDalton = setDalton;
window.resetDalton = () => setDalton('');
window.restoreTheme = () => applyPreset('theme');
window.restoreAccessibility = () => { if(fontRange) { fontRange.value = 100; applyFont(); } };
window.restoreContrast = () => { if(brightRange) { brightRange.value = 100; contrastRange.value = 100; saturationRange.value = 100; applyAllFilters(); } };
window.toggleMascot = toggleMascot;

window.setMode = (mode) => {
    let targetBrightness = 100;
    if(mode === 'light') targetBrightness = 130;
    else if (mode === 'dark') targetBrightness = 70;
    else if (mode === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        targetBrightness = prefersDark ? 100 : 120;
        const prefersContrast = window.matchMedia && window.matchMedia('(prefers-contrast: more)').matches;
        if(prefersContrast && contrastRange) contrastRange.value = 120;
    }
    if(brightRange) {
        brightRange.value = targetBrightness;
        applyAllFilters();
    }
};

/// --- INICIALIZAÇÃO SEGURA DO DOM ---
document.addEventListener('DOMContentLoaded', () => {
  settingsPanel = document.getElementById('settingsPanel');
  malhasContainer = document.getElementById('malhasContainer');
  malhasContainerCa = document.getElementById('malhasContainerCa');
  malhaForm = document.getElementById('malhaForm');
  malhaFormCa = document.getElementById('malhaFormCa');
  resultsInner = document.getElementById('resultsInner');
  resultArea = document.getElementById('resultArea');
  previewName = document.getElementById('previewName');
  activeThemeName = document.getElementById('activeThemeName');

  mascotContainer = document.getElementById('mascotContainer');
  mascotImg = document.getElementById('mascotImg');

  colorPrimary = document.getElementById('colorPrimary');
  colorSecondary = document.getElementById('colorSecondary');
  colorBg = document.getElementById('colorBg');
  colorText = document.getElementById('colorText');

  fontRange = document.getElementById('fontRange');
  fontValue = document.getElementById('fontValue');
  brightRange = document.getElementById('brightRange');
  contrastRange = document.getElementById('contrastRange');
  saturationRange = document.getElementById('saturationRange');
  brightValue = document.getElementById('brightValue');
  contrastValue = document.getElementById('contrastValue');
  saturationValue = document.getElementById('saturationValue');

  // --- Lógica Corrigida dos Conversores de Fasor ---
  const realInput = document.getElementById('realInput');
  const imagInput = document.getElementById('imagInput');
  const modInput = document.getElementById('modInput');
  const angInput = document.getElementById('angInput');
  const resPol = document.getElementById('resultadoPol');
  const resRet = document.getElementById('resultadoRet');

  // Atualizador Retangular -> Polar
  const updateRetToPol = () => {
      if (realInput.value !== "" && imagInput.value !== "") {
          const res = converterRetParaPol(realInput.value, imagInput.value);
          resPol.innerText = `${res.modulo} ∠ ${res.angulo}°`;
      } else {
          resPol.innerText = "-";
      }
  };

  // Atualizador Polar -> Retangular
  const updatePolToRet = () => {
      if (modInput.value !== "" && angInput.value !== "") {
          const res = converterPolParaRet(modInput.value, angInput.value);
          const sign = parseFloat(res.imag) >= 0 ? '+' : '-';
          resRet.innerText = `${res.real} ${sign} j${Math.abs(res.imag)}`;
      } else {
          resRet.innerText = "-";
      }
  };

  // Listeners anexados de forma explícita e direta
  if (realInput && imagInput) {
      realInput.addEventListener('input', updateRetToPol);
      imagInput.addEventListener('input', updateRetToPol);
  }

  if (modInput && angInput) {
      modInput.addEventListener('input', updatePolToRet);
      angInput.addEventListener('input', updatePolToRet);
  }

  if(colorPrimary) {
      colorPrimary.addEventListener('input', updateThemeFromPickers);
      colorSecondary.addEventListener('input', updateThemeFromPickers);
      colorBg.addEventListener('input', updateThemeFromPickers);
      colorText.addEventListener('input', updateThemeFromPickers);
  }
  if(fontRange) fontRange.addEventListener('input', applyFont);
  if(brightRange) {
      brightRange.addEventListener('input', applyAllFilters);
      contrastRange.addEventListener('input', applyAllFilters);
      saturationRange.addEventListener('input', applyAllFilters);
  }

  if(malhaForm) malhaForm.addEventListener('submit', handleSubmit);
  if(malhaFormCa) malhaFormCa.addEventListener('submit', handleCaSubmit);

  document.addEventListener('click', (e) => {
      const openBtn = document.getElementById('openSettingsBtn');
      const isPanelOpen = settingsPanel && settingsPanel.classList.contains('show');
      if (!isPanelOpen) return;
      const clickedInsidePanel = settingsPanel.contains(e.target);
      const clickedOnButton = openBtn && openBtn.contains(e.target);
      if (!clickedInsidePanel && !clickedOnButton) {
          settingsPanel.classList.remove('show');
      }
  });

  applyPreset('theme');
  addMalha();
  addMalha();
  applyAllFilters();
});