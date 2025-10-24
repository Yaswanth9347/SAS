// Simple lightbox for visits media

(function(){
  if(document.getElementById('mediaLightbox')) return;

  const overlay = document.createElement('div');
  overlay.id = 'mediaLightbox';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.85)';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '1000';

  overlay.innerHTML = `
    <div id="lightboxContent" style="max-width:90%;max-height:90%;position:relative">
      <button id="lightboxClose" aria-label="Close" style="position:absolute;top:-42px;right:-8px;background:#fff;color:#333;border:none;border-radius:20px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.2)">Close</button>
      <div id="lightboxInner"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e)=>{
    if(e.target === overlay) closeLightbox();
  });
  overlay.querySelector('#lightboxClose').addEventListener('click', closeLightbox);
})();

function openLightbox(src, type){
  const overlay = document.getElementById('mediaLightbox');
  const inner = document.getElementById('lightboxInner');
  if(!overlay || !inner) return;

  if(type === 'video'){
    inner.innerHTML = `<video controls src="${src}" style="max-width:100%;max-height:80vh;background:#000"></video>`;
  } else if(type === 'image'){
    inner.innerHTML = `<img src="${src}" alt="Media" style="max-width:100%;max-height:80vh;object-fit:contain"/>`;
  } else {
    inner.innerHTML = `<iframe src="${src}" style="width:80vw;height:80vh;background:#fff;border:none"></iframe>`;
  }

  overlay.style.display = 'flex';
}

function closeLightbox(){
  const overlay = document.getElementById('mediaLightbox');
  const inner = document.getElementById('lightboxInner');
  if(overlay) overlay.style.display = 'none';
  if(inner) inner.innerHTML = '';
}

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
