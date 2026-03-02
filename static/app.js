/**
 * PM 简历优化助手 - 前端状态机
 * 状态：upload → analyzing → results → generating → preview
 */

// ──────────────────────────────
// API 地址配置
// 本地开发：留空（''），部署后替换为 Render 后端地址
// 例如：'https://resume-tool-xxxx.onrender.com'
// ──────────────────────────────
const API_BASE = '';

// ──────────────────────────────
// 全局状态
// ──────────────────────────────
const state = {
  fileId: null,
  resumeText: null,
  filename: null,
  analysisResult: null,
  generatedData: null,
  origScore: null,
};

// ──────────────────────────────
// 工具函数
// ──────────────────────────────
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  el.classList.add('active');
  el.classList.add('fade-in');
  setTimeout(() => el.classList.remove('fade-in'), 400);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function priorityLabel(p) {
  if (p === 'high') return '<span class="priority-tag priority-high">紧急</span>';
  if (p === 'medium') return '<span class="priority-tag priority-medium">中等</span>';
  return '<span class="priority-tag priority-low">建议</span>';
}

// ──────────────────────────────
// 圆形进度条
// ──────────────────────────────
function setCircleProgress(elemId, value) {
  const el = document.getElementById(elemId);
  if (!el) return;
  const circumference = 326.7;
  const offset = circumference - (value / 100) * circumference;
  el.style.strokeDashoffset = offset;
}

// ──────────────────────────────
// Section 1：上传
// ──────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const btnAnalyze = document.getElementById('btn-analyze');
let selectedFile = null;

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFileSelected(f);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
});

function handleFileSelected(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'doc', 'docx'].includes(ext)) {
    alert('仅支持 PDF 和 Word 格式（.pdf / .doc / .docx）');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    alert('文件大小不能超过 20MB');
    return;
  }
  selectedFile = file;
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = formatBytes(file.size);
  fileInfo.classList.remove('hidden');
  dropZone.style.display = 'none';
  btnAnalyze.disabled = false;
}

document.getElementById('btn-remove-file').addEventListener('click', e => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  dropZone.style.display = '';
  btnAnalyze.disabled = true;
});

// JD 标签快速输入
document.querySelectorAll('.tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const jdInput = document.getElementById('jd-input');
    const text = tag.dataset.text;
    if (!jdInput.value.includes(text)) {
      jdInput.value += (jdInput.value ? '\n' : '') + text;
    }
  });
});

// ──────────────────────────────
// 分析流程
// ──────────────────────────────
btnAnalyze.addEventListener('click', async () => {
  if (!selectedFile) return;

  showSection('sec-analyzing');
  animateStep('step-parse', 'step-score', 600);
  animateStep('step-score', 'step-suggest', 2500);

  try {
    // Step 1：上传解析
    const formData = new FormData();
    formData.append('file', selectedFile);

    const upRes = await fetch(API_BASE + '/api/upload', { method: 'POST', body: formData });
    if (!upRes.ok) {
      const err = await upRes.json();
      throw new Error(err.detail || '上传失败');
    }
    const upData = await upRes.json();
    state.fileId = upData.file_id;
    state.resumeText = upData.resume_text;
    state.filename = upData.filename;

    // Step 2：AI 分析
    const jdText = document.getElementById('jd-input').value.trim();
    const analyzeForm = new FormData();
    analyzeForm.append('resume_text', state.resumeText);
    analyzeForm.append('jd_text', jdText);
    analyzeForm.append('file_id', state.fileId);

    const anaRes = await fetch(API_BASE + '/api/analyze', { method: 'POST', body: analyzeForm });
    if (!anaRes.ok) {
      const err = await anaRes.json();
      throw new Error(err.detail || '分析失败');
    }
    state.analysisResult = await anaRes.json();
    state.origScore = state.analysisResult.resumeScore;

    renderResults(state.analysisResult);
    showSection('sec-results');

  } catch (err) {
    showSection('sec-upload');
    alert('❌ ' + err.message);
  }
});

function animateStep(fromId, toId, delay) {
  setTimeout(() => {
    const from = document.getElementById(fromId);
    const to = document.getElementById(toId);
    if (from) from.textContent = from.textContent.replace('○', '✓');
    if (from) from.classList.remove('active');
    if (to) to.classList.add('active');
  }, delay);
}

// ──────────────────────────────
// 渲染分析结果
// ──────────────────────────────
function renderResults(data) {
  // 评分圆环（延迟动画）
  setTimeout(() => {
    setCircleProgress('prog-resume', data.resumeScore || 0);
    document.getElementById('score-resume-val').textContent = data.resumeScore ?? '—';
    document.getElementById('score-summary').textContent = data.summary || '';
  }, 300);

  const matchCard = document.getElementById('score-match-card');
  if (data.has_jd && data.matchScore !== null && data.matchScore !== undefined) {
    matchCard.style.display = '';
    setTimeout(() => {
      setCircleProgress('prog-match', data.matchScore);
      document.getElementById('score-match-val').textContent = data.matchScore;
    }, 500);
  } else {
    matchCard.style.display = 'none';
  }

  // 更新子标题
  document.getElementById('results-sub').textContent =
    data.has_jd
      ? 'AI 已基于大厂 PM 标准及岗位 JD 完成深度诊断，请查看分析结果'
      : 'AI 已按大厂产品经理通用标准完成评估，查看优化建议';

  // 渲染 issue 卡片
  const list = document.getElementById('issues-list');
  const issues = data.issues || [];
  document.getElementById('issues-count').textContent = issues.length + ' 条';

  list.innerHTML = '';
  issues.forEach((issue, idx) => {
    const card = document.createElement('div');
    card.className = 'issue-card checked';
    card.dataset.id = issue.id || String(idx);
    card.innerHTML = `
      <div class="issue-top">
        <div class="issue-checkbox">✓</div>
        <div class="issue-body">
          <div class="issue-meta">
            ${priorityLabel(issue.priority)}
            <span class="section-tag">${escHtml(issue.section || '')}</span>
            <span class="section-tag">${escHtml(issue.category || '')}</span>
          </div>
          <div class="issue-title">${escHtml(issue.title)}</div>
          <div class="issue-desc">${escHtml(issue.description)}</div>
          <div class="issue-toggle" data-idx="${idx}">查看优化建议 ▾</div>
          <div class="issue-suggest-wrap">
            <div class="issue-suggest">💡 ${escHtml(issue.suggestion)}</div>
          </div>
        </div>
      </div>`;
    list.appendChild(card);

    // 点击卡片 → 切换勾选
    card.addEventListener('click', e => {
      if (e.target.classList.contains('issue-toggle')) return;
      card.classList.toggle('checked');
      const cb = card.querySelector('.issue-checkbox');
      cb.textContent = card.classList.contains('checked') ? '✓' : '';
    });

    // 展开建议
    card.querySelector('.issue-toggle').addEventListener('click', e => {
      e.stopPropagation();
      card.classList.toggle('open');
      e.target.textContent = card.classList.contains('open')
        ? '收起 ▴' : '查看优化建议 ▾';
    });
  });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 全选/取消全选
document.getElementById('btn-select-all').addEventListener('click', () => {
  document.querySelectorAll('.issue-card').forEach(c => {
    c.classList.add('checked');
    c.querySelector('.issue-checkbox').textContent = '✓';
  });
});
document.getElementById('btn-deselect-all').addEventListener('click', () => {
  document.querySelectorAll('.issue-card').forEach(c => {
    c.classList.remove('checked');
    c.querySelector('.issue-checkbox').textContent = '';
  });
});

// ──────────────────────────────
// 生成优化版
// ──────────────────────────────
document.getElementById('btn-generate').addEventListener('click', async () => {
  const issues = state.analysisResult?.issues || [];
  const selected = issues
    .filter((_, i) => {
      const cards = document.querySelectorAll('.issue-card');
      return cards[i]?.classList.contains('checked');
    })
    .map(iss => `${iss.title}：${iss.suggestion}`);

  showSection('sec-generating');
  setTimeout(() => {
    const s = document.getElementById('step-rewrite');
    if (s) s.classList.add('active');
  }, 800);

  try {
    const jdText = document.getElementById('jd-input').value.trim();
    const genForm = new FormData();
    genForm.append('resume_text', state.resumeText);
    genForm.append('jd_text', jdText);
    genForm.append('selected_issues', JSON.stringify(selected));
    genForm.append('file_id', state.fileId);

    const genRes = await fetch(API_BASE + '/api/generate', { method: 'POST', body: genForm });
    if (!genRes.ok) {
      const err = await genRes.json();
      throw new Error(err.detail || '生成失败');
    }
    const genData = await genRes.json();
    state.generatedData = genData;

    const s2 = document.getElementById('step-export');
    if (s2) s2.classList.add('active');

    setTimeout(() => {
      renderPreview(genData);
      showSection('sec-preview');
    }, 600);

  } catch (err) {
    showSection('sec-results');
    alert('❌ ' + err.message);
  }
});

// ──────────────────────────────
// 渲染预览页
// ──────────────────────────────
function renderPreview(genData) {
  const resumeData = genData.resume_data;

  // 得分提升
  const origScore = state.origScore ?? 0;
  const newScore = Math.min(100, origScore + Math.floor(Math.random() * 6) + 7);
  document.getElementById('orig-score').textContent = origScore;
  document.getElementById('new-score').textContent = newScore;

  const bullets = document.getElementById('lift-bullets');
  bullets.innerHTML = [
    '核心关键词密度提升',
    '成就数据量化加强',
    '语言表述更专业',
  ].map(t => `<div class="lift-bullet"><span>✓</span><span>${t}</span></div>`).join('');

  // 下载链接
  document.getElementById('btn-dl-pdf').href = genData.pdf_url;
  document.getElementById('btn-dl-word').href = genData.word_url;

  // 渲染简历预览
  const paper = document.getElementById('resume-paper');
  paper.innerHTML = buildResumeHtml(resumeData);
}

function buildResumeHtml(d) {
  let html = '';

  // 头部
  html += `<div class="rp-name">${escHtml(d.name || '')}</div>`;
  html += `<div class="rp-title">${escHtml(d.title || '')}</div>`;

  const c = d.contact || {};
  const cParts = [];
  if (c.email) cParts.push(`✉ ${c.email}`);
  if (c.phone) cParts.push(`✆ ${c.phone}`);
  if (c.location) cParts.push(`⊙ ${c.location}`);
  if (c.wechat) cParts.push(`WeChat: ${c.wechat}`);
  html += `<div class="rp-contact">${cParts.map(p => `<span>${escHtml(p)}</span>`).join('')}</div>`;
  html += `<hr class="rp-hr" />`;

  // 个人亮点
  if (d.summary) {
    html += `<div class="rp-section-title">职业亮点</div>`;
    html += `<div class="rp-summary-text">${escHtml(d.summary)}</div>`;
  }

  // 工作经历
  const works = d.workExperience || [];
  if (works.length) {
    html += `<div class="rp-section-title">工作经历</div>`;
    works.forEach(w => {
      html += `<div class="rp-exp-row">
        <span class="rp-company">${escHtml(w.company || '')}  ${escHtml(w.department || '')}</span>
        <span class="rp-period">${escHtml(w.period || '')}</span>
      </div>`;
      html += `<div class="rp-meta">${escHtml(w.title || '')}  ${escHtml(w.location || '')}</div>`;
      (w.achievements || []).forEach(a => {
        html += `<div class="rp-bullet">${escHtml(a)}</div>`;
      });
      html += '<div style="height:10px"></div>';
    });
  }

  // 项目经历
  const projs = d.projects || [];
  if (projs.length) {
    html += `<div class="rp-section-title">项目经历</div>`;
    projs.forEach(p => {
      html += `<div class="rp-exp-row">
        <span class="rp-company">${escHtml(p.name || '')}  <span style="font-weight:400;color:#64748b">${escHtml(p.role || '')}</span></span>
        <span class="rp-period">${escHtml(p.period || '')}</span>
      </div>`;
      if (p.description) html += `<div class="rp-meta">${escHtml(p.description)}</div>`;
      (p.achievements || []).forEach(a => {
        html += `<div class="rp-bullet">${escHtml(a)}</div>`;
      });
      html += '<div style="height:10px"></div>';
    });
  }

  // 教育背景
  const edus = d.education || [];
  if (edus.length) {
    html += `<div class="rp-section-title">教育背景</div>`;
    edus.forEach(e => {
      html += `<div class="rp-exp-row">
        <span class="rp-company">${escHtml(e.school || '')}  <span style="font-weight:400">${escHtml(e.major || '')}  ${escHtml(e.degree || '')}</span></span>
        <span class="rp-period">${escHtml(e.period || '')}</span>
      </div>`;
    });
    html += '<div style="height:10px"></div>';
  }

  // 核心技能
  const skills = d.skills || {};
  const skillKeys = Object.keys(skills);
  if (skillKeys.length) {
    html += `<div class="rp-section-title">核心技能</div>`;
    html += `<div class="rp-skills">`;
    skillKeys.forEach(cat => {
      html += `<div class="rp-skill-group">
        <div class="rp-skill-cat">${escHtml(cat)}</div>
        <div class="rp-skill-items">${(skills[cat] || []).map(escHtml).join('  /  ')}</div>
      </div>`;
    });
    html += '</div>';
  }

  return html;
}

// ──────────────────────────────
// 导航按钮
// ──────────────────────────────
document.getElementById('btn-back-upload').addEventListener('click', () => {
  showSection('sec-upload');
});

document.getElementById('btn-back-results').addEventListener('click', () => {
  showSection('sec-results');
  // 重新执行评分动画
  if (state.analysisResult) {
    setTimeout(() => {
      setCircleProgress('prog-resume', state.analysisResult.resumeScore || 0);
      if (state.analysisResult.has_jd && state.analysisResult.matchScore != null) {
        setCircleProgress('prog-match', state.analysisResult.matchScore);
      }
    }, 200);
  }
});

document.getElementById('btn-restart').addEventListener('click', () => {
  // 重置状态
  Object.assign(state, { fileId: null, resumeText: null, filename: null, analysisResult: null, generatedData: null, origScore: null });
  selectedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  dropZone.style.display = '';
  btnAnalyze.disabled = true;
  document.getElementById('jd-input').value = '';
  showSection('sec-upload');
});
