head='''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ForgeFit">
<meta name="theme-color" content="#090d16">
<title>ForgeFit — Smart Recovery &amp; Overload Tracker</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon-180.png">
<style>
'''
css=open('src/style.css').read(); body=open('src/body.html').read()
js=''
for i,f in enumerate(['core.js','ui.js','extras.js','more.js','features.js']):
    s=open('src/'+f).read()
    if i: s=s.replace("'use strict';\n",'',1)
    js+=s+'\n'
import re
ver=re.search(r"forgefit-v(\d+)",open('sw.js').read()).group(1)
js=js.replace('__APP_VER__',ver)
open('index.html','w').write(head+css+'</style>\n</head>\n<body>\n'+body+'<script>\n'+js+'</script>\n</body>\n</html>\n')
open('/tmp/all.js','w').write(js)
