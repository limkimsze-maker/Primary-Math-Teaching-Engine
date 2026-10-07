from pathlib import Path

path = Path('public/sls-packager.js')
text = path.read_text()
old = """  zip.file('index.html',inject(html,opts.baseHref||''));
  zip.file('index.js',COMPILER_INDEX_JS);
  zip.file('xapiwrapper.min.js',XAPIWRAPPER_MIN_JS);
  const blob=await zip.generateAsync({type:'blob'});"""
new = """  const exportedHtml=inject(html,opts.baseHref||'');
  zip.file('index.html',exportedHtml);
  zip.file('index.js',COMPILER_INDEX_JS);
  zip.file('xapiwrapper.min.js',XAPIWRAPPER_MIN_JS);

  // TIME_FOREST_ASSET_BUNDLE_V1
  // Time activities use relative forest images. Include them in the SLS ZIP so
  // the same sky clue appears offline/in SLS without changing any xAPI plumbing.
  if(/\"engine\"\\s*:\\s*\"time\"/.test(String(html||''))){
    const assetBase=opts.baseHref||new URL('./',location.href).href;
    const timeForestAssets=[
      'assets/time-forest/morning-sun.webp',
      'assets/time-forest/afternoon-sun.webp',
      'assets/time-forest/night-moon.webp',
      'assets/time-forest/early-morning-moon-owl.webp'
    ];
    for(const asset of timeForestAssets){
      const assetUrl=new URL(asset,assetBase).href;
      const response=await fetch(assetUrl,{cache:'no-store'});
      if(!response.ok)throw new Error('Could not include Time sky image: '+asset+' (HTTP '+response.status+')');
      zip.file(asset,await response.arrayBuffer());
    }
  }

  const blob=await zip.generateAsync({type:'blob'});"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'Expected exactly one ZIP payload block, found {count}')
path.write_text(text.replace(old, new, 1))
