(function() {
  var scene    = document.getElementById('lpScene');
  var cord     = document.getElementById('lpCord');
  var lampWrap = document.getElementById('lpLampWrap');
  var hint     = document.getElementById('lpHint');
  var isOn     = false;
  var busy     = false;

  function toggle() {
    if (busy) return;
    busy = true;

    /* 1 — اهتزاز الحبل */
    cord.classList.add('pulled');
    setTimeout(function() { cord.classList.remove('pulled'); }, 220);

    /* 2 — رجّة المصباح */
    lampWrap.style.animation = 'none';
    lampWrap.style.transform = 'rotate(-5deg)';
    setTimeout(function() {
      lampWrap.style.transform = 'rotate(4deg)';
      setTimeout(function() {
        lampWrap.style.transform = '';
        lampWrap.style.animation = '';
      }, 110);
    }, 110);

    /* 3 — تشغيل / إطفاء */
    setTimeout(function() {
      isOn = !isOn;
      scene.classList.toggle('on', isOn);
      hint.textContent = isOn ? 'اسحب لإطفاء 🌙' : 'اسحب الحبل 💡';
      busy = false;
    }, 200);
  }

  cord.addEventListener('click', function(e) { e.stopPropagation(); toggle(); });
  lampWrap.addEventListener('click', toggle);
})();
