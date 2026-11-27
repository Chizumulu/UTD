// Batch scroll hint geometry reads before writes; preserve existing triggers.
export function optimizeAppLayout(app){
 const replace=(before,after)=>{if(app.split(before).length!==2)throw Error('Expected unique layout source: '+before.slice(0,100));app=app.replace(before,()=>after);};
 replace("  const scrollFadeUpdaters = [];","  const scrollFadeUpdaters = [];\n  let scrollFadeFrame = null;");
 replace("    function update() {\n      const maxScroll = scroller.scrollWidth - scroller.clientWidth;\n      const scrolled = scroller.scrollLeft;\n      fadeWrap.classList.toggle('show-left', scrolled > 4);\n      fadeWrap.classList.toggle('show-right', scrolled < maxScroll - 4);\n    }",
 "    function measure() {\n      const maxScroll = scroller.scrollWidth - scroller.clientWidth;\n      const scrolled = scroller.scrollLeft;\n      const left = scrolled > 4;\n      const right = scrolled < maxScroll - 4;\n      return () => {\n        if (fadeWrap.classList.contains('show-left') !== left) fadeWrap.classList.toggle('show-left', left);\n        if (fadeWrap.classList.contains('show-right') !== right) fadeWrap.classList.toggle('show-right', right);\n      };\n    }\n    const update = refreshScrollFadeHints;");
 replace("    scrollFadeUpdaters.push(update);","    scrollFadeUpdaters.push(measure);");
 replace("    scrollFadeUpdaters.forEach(update => update());",
 "    if (scrollFadeFrame !== null) return;\n    scrollFadeFrame = requestAnimationFrame(() => {\n      scrollFadeFrame = null;\n      const writes = scrollFadeUpdaters.map(measure => measure());\n      writes.forEach(write => write());\n    });");
 replace("    const longer = w1 < w2 ? line2 : line1;\n    const diff = longer.getBoundingClientRect().width - shorter.getBoundingClientRect().width;","    const diff = Math.abs(w1 - w2);");
 const bt=String.fromCharCode(96), dollar=String.fromCharCode(36);
 const translate=expr=>bt+'translateX('+dollar+'{'+expr+' - 4}px)'+bt;
 replace("    indicator.style.transform = "+translate('activeBtn.offsetLeft')+";\n    indicator.style.width = activeBtn.offsetWidth + 'px';",
 "    const left = activeBtn.offsetLeft, width = activeBtn.offsetWidth;\n    const top = activeBtn.offsetTop, height = activeBtn.offsetHeight;\n    indicator.style.transform = "+translate('left')+";\n    indicator.style.width = width + 'px';");
 replace("    indicator.style.top = activeBtn.offsetTop + 'px';\n    indicator.style.bottom = 'auto';\n    indicator.style.height = activeBtn.offsetHeight + 'px';","    indicator.style.top = top + 'px';\n    indicator.style.bottom = 'auto';\n    indicator.style.height = height + 'px';");
 replace("        if (!b || !b.offsetWidth) return;\n        indicator.style.transform = "+translate('b.offsetLeft')+";\n        indicator.style.width = b.offsetWidth + 'px';\n        indicator.style.top = b.offsetTop + 'px';\n        indicator.style.height = b.offsetHeight + 'px';",
 "        if (!b) return;\n        const width = b.offsetWidth;\n        if (!width) return;\n        const left = b.offsetLeft, top = b.offsetTop, height = b.offsetHeight;\n        indicator.style.transform = "+translate('left')+";\n        indicator.style.width = width + 'px';\n        indicator.style.top = top + 'px';\n        indicator.style.height = height + 'px';");
 return app;
}
