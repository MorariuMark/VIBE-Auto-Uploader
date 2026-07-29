(function() {
  try {
    var toggleCount = 0, defaultColorCount = 0, bgCount = 0;

    // 1. Enable all product toggles that are OFF
    var allToggles = document.querySelectorAll('.canvas-selection div.on-off.canvas-enable');
    allToggles.forEach(function(toggle){
      var hidden = toggle.querySelector('input[type="hidden"]');
      var isOff = hidden && hidden.value === 'false';
      var span = toggle.querySelector('span');
      if (!isOff && span) {
        isOff = span.classList.contains('disabled');
      }
      if (isOff) {
        var clickable = toggle.querySelector('span.enabled, a, button');
        if (clickable) clickable.click(); else toggle.click();
        toggleCount++;
      }
    });

    // 2. Set all default color dropdowns to the first real option
    var allDDs = document.querySelectorAll('.canvas-selection .dd-container');
    allDDs.forEach(function(dd){
      var selText = dd.querySelector('.dd-selected-text');
      var currentVal = selText ? (selText.textContent || '').trim() : '';
      if (currentVal.toLowerCase() === 'select default color' || currentVal.toLowerCase() === 'select default colour') {
        var ddSelect = dd.querySelector('.dd-select');
        if (ddSelect) ddSelect.click();
        var opts = dd.querySelectorAll('.dd-option');
        for (var i = 0; i < opts.length; i++) {
          var optTextEl = opts[i].querySelector('.dd-option-text');
          var optText = optTextEl ? (optTextEl.textContent || '').trim() : '';
          if (optText && optText.toLowerCase() !== 'select default color' && optText.toLowerCase() !== 'select default colour') {
            opts[i].click();
            defaultColorCount++;
            break;
          }
        }
      }
    });

    // 3. Set all bg_color inputs to white
    if (typeof jQuery !== 'undefined') {
      jQuery('input[type="text"][name*="bg_color"]').each(function(){
        try {
          jQuery(this).minicolors('value', '#FFFFFF');
          bgCount++;
        } catch(e) {
          try {
            var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(this, '#FFFFFF');
            this.dispatchEvent(new Event('input', { bubbles: true }));
            this.dispatchEvent(new Event('change', { bubbles: true }));
            bgCount++;
          } catch(e2) {}
        }
      });
    }

    console.log('[TP Enable] Done: toggles=' + toggleCount + ' defaultColors=' + defaultColorCount + ' bg=' + bgCount);
    document.body.dataset.tpProductResult = 'bg:' + bgCount + ' defaultColors:' + defaultColorCount + ' toggles:' + toggleCount;
  } catch(e) {
    console.error('[TP Enable] Error:', e);
    document.body.dataset.tpProductResult = 'err:' + e.message;
  }
})();
