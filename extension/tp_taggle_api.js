(function() {
  try {
    var b = document.getElementById('__tp_taggle_bridge');
    if (!b) return;
    var tagsStr = b.getAttribute('data-tags');
    if (!tagsStr) { b.textContent = 'no_tags'; return; }
    var tags = JSON.parse(tagsStr);
    var input = document.querySelector('.taggle_input');
    if (!input) { b.textContent = 'no_input'; return; }
    var container = input.closest('.taggle_container') || input.parentElement;
    var taggle = container.taggle;
    if (!taggle && window.jQuery) { try { taggle = jQuery(container).data('taggle'); } catch(e) {} }
    if (!taggle) {
      for (var k in window) {
        try {
          if (window[k] && window[k].container === container && typeof window[k].add === 'function') { taggle = window[k]; break; }
        } catch(e) {}
      }
    }
    if (!taggle) { b.textContent = 'no_instance'; return; }
    var count = 0;
    for (var i = 0; i < tags.length; i++) {
      try { taggle.add(tags[i]); count++; } catch(e) { try { taggle.add(tags[i].trim()); } catch(e2) {} }
    }
    b.textContent = 'ok:' + count;
  } catch(e) {
    var b2 = document.getElementById('__tp_taggle_bridge');
    if (b2) b2.textContent = 'err:' + e.message;
  }
})();
