const comparison='https://seller-content.wildberries.ru/ns/analytics-api/content-analytics/api/v2/sales-funnel/seller/comparisons';
const analytics='https://seller-analytics-api.wildberries.ru/api/analytics/v3/sales-funnel/products';
async function probe(url,token,body,check,request) {
  try {
    const r=await request(url,{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
    if(r.status===401||r.status===403)return `HTTP ${r.status}: доступ отклонён. Это не доказывает отсутствие метода; возможны права токена или другой способ авторизации.`;
    if(r.status===429)return 'HTTP 429: ограничение частоты. Повторите позже.';
    if(!r.ok)return `HTTP ${r.status}: запрос не подтверждён.`;
    let data;try{data=await r.json();}catch{return 'HTTP 200, ответ не JSON — доступ к данным не подтверждён.';}
    return check(data)?'Доступ подтверждён: получена ожидаемая структура данных.':'HTTP 200, структура данных не подтверждена. Выгрузка не включена.';
  }catch{return 'Нет ответа: сетевая ошибка или тайм-аут. Токен и содержимое ответа не выводятся.';}
}
export async function diagnose(token,subjectID,date,request=fetch) {
  if(!token)return 'Не задан API-токен кабинета.';
  const c=await probe(comparison,token,{subjectID,skipDeletedNm:false,start:date,end:date},d=>d?.error===false&&Array.isArray(d.data?.subjectSellers?.top)&&!!d.data?.chart?.seller,request);
  const a=await probe(analytics,token,{selectedPeriod:{start:date,end:date},subjectIds:[subjectID],nmIds:[],brandNames:[],tagIds:[],skipDeletedNm:false,limit:1,offset:0},d=>!d?.error&&Array.isArray(d.data?.products),request);
  return `Сравнение с конкурентами (обычный Authorization): ${c}\n\nСобственная воронка, публичный API: ${a}`;
}
