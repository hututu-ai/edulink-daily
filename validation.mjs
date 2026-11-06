export const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validMonth=s=>typeof s==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function validateContent(data){
 if(data.schemaVersion!==1||!validDate(data.updatedAt)||!Array.isArray(data.issues)||!Array.isArray(data.competitions))throw Error('Invalid editorial root');
 const ids=new Set();
 const text=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.length>5000)throw Error('Invalid '+label)};
 const url=value=>{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))throw Error('Unsafe source URL')};
 const checkDate=value=>{if(!validDate(value))throw Error('Invalid date: '+value)};
 const source=s=>{if(!s)throw Error('Missing source');text(s.name,'source');url(s.url);if(s.publishedDate===null)text(s.publishedDateNote,'missing publication date explanation');else checkDate(s.publishedDate);checkDate(s.verifiedAt);if(s.verification!=='verified')throw Error('Published content requires source verification');if(s.verifiedAt>data.updatedAt)throw Error('Verification is after update date')};
 for(const issue of data.issues){
  if(issue.status!=='published')continue;if(!validDate(issue.id)||issue.id!==issue.date||ids.has('issue:'+issue.id))throw Error('Invalid or duplicate issue');ids.add('issue:'+issue.id);checkDate(issue.reviewedAt);if(issue.date>data.updatedAt||issue.reviewedAt>data.updatedAt)throw Error('Future issue');text(issue.title,'issue title');text(issue.intro,'issue intro');
  if(!Array.isArray(issue.items)||!issue.items.length)throw Error('Empty issue');
  for(const key of ['headlineTitle','headlineDeck','editorNote'])if(issue[key]!==undefined)text(issue[key],key);
  if(issue.headlineId&&!issue.items.some(x=>x.id===issue.headlineId))throw Error('Headline item not found');
  if(issue.quickReads){if(!Array.isArray(issue.quickReads)||issue.quickReads.length>3)throw Error('Invalid quick reads');for(const x of issue.quickReads){if(!issue.items.some(i=>i.id===x.itemId))throw Error('Quick-read item not found');text(x.text,'quick-read text')}}
  if(issue.action){text(issue.action.title,'action title');if(!Array.isArray(issue.action.steps)||!issue.action.steps.length||issue.action.steps.length>5)throw Error('Invalid action steps');issue.action.steps.forEach(x=>text(x,'action step'))}
  if(issue.radarSnapshots){if(!Array.isArray(issue.radarSnapshots)||issue.radarSnapshots.some(x=>x.status!=='published'||x.reviewedAt>issue.date||x.source?.verifiedAt>issue.date))throw Error('Invalid radar snapshot');validateContent({schemaVersion:1,updatedAt:issue.date,issues:[],competitions:issue.radarSnapshots})}
  const itemIds=new Set();
  for(const item of issue.items){if(itemIds.has(item.id))throw Error('Duplicate issue item');itemIds.add(item.id);if(!['news','case','resource','benefit','lesson'].includes(item.type))throw Error('Invalid item type');if(!/^[a-z0-9-]+$/.test(item.id||''))throw Error('Invalid item ID');text(item.title,'item title');text(item.summary,'summary');text(item.takeaway,'takeaway');source(item.source);if(item.resourceUrl)url(item.resourceUrl);if(!Array.isArray(item.subjects))throw Error('Missing subject tags');
   const allowedSections={case:['works'],news:['tools'],resource:['tools','benefit'],benefit:['benefit'],lesson:['lessons']};
   if(item.section&&!allowedSections[item.type].includes(item.section))throw Error('Invalid editorial section');
   if(item.type==='benefit'){
    const b=item.benefit;if(!b)throw Error('Benefit requires verified eligibility and claim rules');
    for(const k of ['eligibility','validityNote','costNote'])text(b[k],'benefit '+k);
    if(b.deadline)checkDate(b.deadline);else text(b.deadlineNote,'benefit deadline explanation');
    if(!Array.isArray(b.claimSteps)||!b.claimSteps.length||b.claimSteps.length>8)throw Error('Missing benefit claim steps');b.claimSteps.forEach(x=>text(x,'claim step'));url(item.resourceUrl);
   }
   if(item.type==='lesson'){
    const l=item.lesson;if(!l)throw Error('Lesson requires an accessible concrete lesson');
    for(const k of ['stage','subject','format','accessNote'])text(l[k],'lesson '+k);url(l.watchUrl);
    if(l.date)checkDate(l.date);else text(l.dateNote,'lesson date explanation');
   }
   if(item.type==='case'&&(issue.editorialStandard==='teacher-first-v1'||data.editorialStandard==='teacher-first-v1')){
    text(item.problem,'teaching problem');text(item.author,'case author');text(item.methodNote,'method note');
    if(!item.work||item.work.verification!=='opened')throw Error('Case requires an opened real work');url(item.work.url);checkDate(item.work.checkedAt);if(item.work.checkedAt>issue.reviewedAt)throw Error('Case verification after review');text(item.work.accessNote,'work access');
    if(!Array.isArray(item.tools)||!item.tools.length)throw Error('Missing verified production tools');for(const tool of item.tools){text(tool.name,'production tool');url(tool.evidenceUrl)}
    if(!Array.isArray(item.steps)||!item.steps.length)throw Error('Missing case steps');item.steps.forEach(x=>text(x,'case step'));
    if(item.work.preview){const p=item.work.preview;if(!/^\/(assets|api\/daily-image)\/[a-z0-9-]+\.(png|webp|jpg)$/.test(p.path))throw Error('Invalid work preview');text(p.alt,'preview alt');text(p.caption,'preview caption');url(p.creditUrl);url(p.licenseUrl)}
   }
  }
 }
 for(const c of data.competitions){
  if(c.status!=='published')continue;if(!/^[a-z0-9-]+$/.test(c.id)||ids.has('competition:'+c.id))throw Error('Invalid competition ID');ids.add('competition:'+c.id);source(c.source);checkDate(c.reviewedAt);if(c.reviewedAt>data.updatedAt)throw Error('Future review');
  for(const field of ['title','level','kind','target','summary','city'])text(c[field],field);if(!Array.isArray(c.provinces)||!c.provinces.length||!Array.isArray(c.requirements)||!Array.isArray(c.dates)||!c.dates.length)throw Error('Missing competition fields');
  if(data.editorialStandard==='teacher-first-v1'&&(!c.schoolStages?.some(x=>['小学','初中','高中','特殊教育'].includes(x))||!c.eligibilityNote||!c.deliverables?.length))throw Error('Competition requires K12 eligibility and deliverables');
  for(const d of c.dates){text(d.label,'date label');if(!['deadline','event'].includes(d.kind))throw Error('Invalid date kind');if(d.month){if(!validMonth(d.month)||d.date||d.endDate||d.kind==='deadline')throw Error('Imprecise deadline/month')}else{checkDate(d.date);if(d.endDate){checkDate(d.endDate);if(d.endDate<d.date)throw Error('Reversed date range')}}}
 }
 return true;
}
