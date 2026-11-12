// Capture the implemented builder in light/dark themes and on a narrow screen.
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {chromium} from 'playwright-core'
const [bench='gongzuo-final-ui',port='44175']=process.argv.slice(2)
assert.match(bench,/^[a-z0-9-]+$/);assert.match(port,/^\d+$/)
assert.ok(Number(port)>=1024&&Number(port)<=65535&&port!=='3080')
const root=dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const out=resolve(process.env.GONGZUO_VISUAL_OUTPUT||join(root,'docs/design/verification','visual-'+Date.now().toString(36)))
mkdirSync(out,{recursive:true})
const login=readFileSync(join(root,'.dsh-test-'+bench,'web.log'),'utf8').match(new RegExp('http://127\\.0\\.0\\.1:'+port+'/\\?token=[^\\s]+'))?.[0]
assert.ok(login,'Use the isolated local test-profile login')
const result={status:'running',commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),viewport:{width:1487,height:1058},themes:[],screenshots:[],errors:[]}
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/chromium',headless:true})
try{
 for(const scheme of ['light','dark']){
  const context=await browser.newContext({viewport:result.viewport,deviceScaleFactor:1,locale:'zh-CN',colorScheme:scheme,reducedMotion:'reduce'})
  const page=await context.newPage();page.setDefaultTimeout(20000)
  page.on('pageerror',e=>result.errors.push(e.message))
  page.on('console',e=>{if(e.type()==='error')result.errors.push(e.text())})
  await page.goto(login)
  await page.locator('.gw-nav').first().waitFor({timeout:60000})
  await page.locator('.gw-nav').first().getByRole('button').nth(1).click()
  const work=page.locator('.gw-workspace:not([data-leaving])')
  await work.waitFor()
  if(!await work.locator('.gw-wizard').isVisible())await work.locator('.gw-page-head>.gw-primary').click()
  await work.locator('.gw-role-card').last().waitFor()
  await page.evaluate(()=>document.fonts.ready)
  await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.gw-role-art img')];return images.length===6&&images.every(i=>i.complete&&i.naturalWidth>0)})
  const styles=await work.evaluate(node=>({background:getComputedStyle(node).backgroundColor,text:getComputedStyle(node).color,imageFrames:[...node.querySelectorAll('.gw-role-art img')].map(i=>getComputedStyle(i).boxShadow),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}))
  const channels=styles.background.match(/[0-9.]+/g).slice(0,3).map(Number)
  assert.ok(scheme==='dark'?Math.max(...channels)<128:Math.min(...channels)>200,'The requested system theme must render the corresponding workspace surface')
  assert.ok(styles.imageFrames.every(x=>x==='none'),'Role illustrations must not inherit photo frames')
  assert.equal(styles.reducedMotion,true)
  result.themes.push({scheme,...styles})
  const desktop=scheme+'-builder.png';await page.screenshot({path:join(out,desktop)});result.screenshots.push(desktop)
  if(scheme==='light'){
   await work.locator('.gw-inspector').screenshot({path:join(out,'member-inspector.png')});result.screenshots.push('member-inspector.png')
   await page.setViewportSize({width:390,height:844})
   await work.locator('.gw-team-form input').click()
   await page.screenshot({path:join(out,'mobile-builder.png')});result.screenshots.push('mobile-builder.png')
   await work.locator('.gw-wizard-footer').screenshot({path:join(out,'mobile-footer.png')});result.screenshots.push('mobile-footer.png')
  }
  await context.close()
 }
 assert.deepEqual(result.errors,[])
 result.status='passed'
}catch(e){result.status='failed';result.error=e.stack||String(e);process.exitCode=1}
finally{await browser.close();result.finishedAt=new Date().toISOString();writeFileSync(join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))}
