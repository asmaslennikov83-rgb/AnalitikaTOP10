import {validateResponse} from './core.mjs';
const endpoint='https://seller-content.wildberries.ru/ns/analytics-api/content-analytics/api/v2/sales-funnel/seller/comparisons';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function comparisons(subjectID,period) {
  const token=process.env.WB_AUTHORIZEV3;
  if(!token) throw new Error('Не заполнен WB_AUTHORIZEV3 в локальном .env');
  for(let attempt=0;attempt<4;attempt++) {
    const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',Authorizev3:token},body:JSON.stringify({subjectID,skipDeletedNm:false,start:period.start,end:period.end})});
    if(response.status===401 || response.status===403) throw new Error('WB отклонил доступ. Обновите локальный Authorizev3; могут требоваться дополнительные параметры сессии.');
    if(response.status===429 || response.status>=500) {
      if(attempt===3) throw new Error('WB временно недоступен или ограничил запросы. Повторите позже.');
      const retry=Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retry)&&retry>0?Math.min(retry*1000,120000):3000*2**attempt);continue;
    }
    if(!response.ok) throw new Error(`WB: HTTP ${response.status}`);
    let body;try{body=await response.json();}catch{throw new Error('WB вернул ответ не в формате JSON');}
    return validateResponse(body);
  }
}
export async function collect(subjects,periods,onProgress=()=>{}) {
  const records=[];
  for(const subject of subjects) for(const period of periods) {
    if(records.length) await sleep(Math.max(1000,Number(process.env.WB_REQUEST_DELAY_MS)||2000));
    const data=await comparisons(subject.id,period);
    records.push({subject,period,data});onProgress(records.length,subjects.length*periods.length);
  }
  return records;
}
