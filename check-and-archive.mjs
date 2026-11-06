import {mkdir,writeFile} from 'node:fs/promises';
import {validateContent} from './validation.mjs';
const SITE='https://edulink.hututu.site',CLOUD='https://edulink-editorial.tutu-yunnan-trip-2026.workers.dev';
const date=(t=new Date())=>new Date(t.getTime()+8*3600000).toISOString().slice(0,10);
async function get(url){let error;for(let n=0;n<2;n++){try{const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);return r}catch(e){error=e}}throw error}
await mkdir('published/images',{recursive:true});const health={checkedAt:new Date().toISOString(),checks:[]};let bad=false;
try{
 const data=await(await get(SITE+'/api/editorial')).json();validateContent(data);if(data.coverage?.regions?.length!==31||!data.issues?.length)throw Error('Unexpected public content shape');
 const out={schemaVersion:1,updatedAt:data.updatedAt,issues:data.issues.filter(i=>i.status==='published'),competitions:[],automation:data.cloudAutomation||null,sourceChecks:{date:data.collection.date,checkedAt:new Date().toISOString(),sources:data.sources.map(s=>({id:s.id,name:s.name,province:s.province,url:s.url,status:s.check,checkedAt:s.lastCheckedAt||s.checkedAt,candidates:0}))}};
 await writeFile('published/editorial.json',JSON.stringify(out,null,2)+'\n');
 for(const issue of out.issues)for(const item of issue.items){const p=item.work?.preview?.path;if(!p?.startsWith('/api/daily-image/'))continue;const filename=p.split('/').at(-1);if(!/^(air-garage|wave-band)-\d{4}-\d{2}-\d{2}\.png$/.test(filename))throw Error('Unexpected image name');const r=await get(SITE+p);if(!r.headers.get('content-type')?.includes('image/png'))throw Error('Not a PNG');const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>2500000)throw Error('Image too large');await writeFile('published/images/'+filename,bytes)}
 const latest=[...out.issues].sort((a,b)=>b.date.localeCompare(a.date))[0];const html=await(await get(SITE+'/daily/'+latest.id)).text();if(!html.includes(latest.items[0].title))throw Error('Latest body not readable');health.checks.push({name:'public-body-and-archive',passed:true,latestIssue:latest.id});
}catch{health.checks.push({name:'public-body-and-archive',passed:false});bad=true}
try{
 const status=await(await get(CLOUD+'/status')).json(),now=new Date(),time=new Date(now.getTime()+8*3600000).toISOString().slice(11,16);const expected=time<'08:45'?date(new Date(now.getTime()-86400000)):date(now);
 const passed=status.date>=expected&&Array.isArray(status.sections)&&status.sections.length===4&&status.sections.every(s=>['qualified','no-new-content'].includes(s.status))&&['published','already-published','no-new-content'].includes(status.status);
 const scheduleExpected=date(now)>='2026-11-07'&&time>='09:15';const schedulePassed=!scheduleExpected||(status.lastSchedule?.source==='cloudflare-cron'&&status.lastSchedule?.date>=date(now));health.checks.push({name:'natural-cron-trigger',passed:schedulePassed,expected:scheduleExpected,lastScheduledAt:status.lastSchedule?.scheduledAt||null});if(!schedulePassed)bad=true;
 health.checks.push({name:'independent-four-section-cloud-run',passed,date:status.date,status:status.status,sections:status.sections?.map(s=>({section:s.section,status:s.status,checked:s.checked}))});if(!passed)bad=true;
}catch{const scheduleExpected=date(now)>='2026-11-07'&&time>='09:15';const schedulePassed=!scheduleExpected||(status.lastSchedule?.source==='cloudflare-cron'&&status.lastSchedule?.date>=date(now));health.checks.push({name:'natural-cron-trigger',passed:schedulePassed,expected:scheduleExpected,lastScheduledAt:status.lastSchedule?.scheduledAt||null});if(!schedulePassed)bad=true;
 health.checks.push({name:'independent-four-section-cloud-run',passed:false});bad=true}
health.passed=!bad;await writeFile('published/health.json',JSON.stringify(health,null,2)+'\n');console.log(JSON.stringify(health));if(bad)process.exitCode=1;
