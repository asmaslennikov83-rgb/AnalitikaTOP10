const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function discoverSubjects(token,request=fetch) {
  if(!token) throw new Error('Не задан API-токен WB с доступом «Контент»');
  const found=new Map();let cursor={limit:100};const seen=new Set();
  while(true) {
    let body;
    for(let attempt=0;attempt<4;attempt++) {
      const response=await request('https://content-api.wildberries.ru/content/v2/get/cards/list',{method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({settings:{sort:{ascending:true},cursor,filter:{withPhoto:-1}}})});
      if(response.status===401||response.status===403) throw new Error('API WB отклонил токен. Проверьте доступ к категории «Контент»');
      if(response.status===429||response.status>=500) {if(attempt===3) throw new Error('API карточек WB временно недоступен');await sleep(2000*2**attempt);continue;}
      if(!response.ok) throw new Error(`API карточек WB: HTTP ${response.status}`);
      body=await response.json();break;
    }
    if(body?.error||!Array.isArray(body?.cards)) throw new Error('Изменилась структура ответа списка карточек WB');
    for(const card of body.cards) {
      if(!Number.isInteger(card.subjectID)||!card.subjectName) throw new Error('В карточке WB отсутствует предмет');
      found.set(card.subjectID,{id:card.subjectID,name:card.subjectName});
    }
    if(body.cards.length<100) break;
    const next=body.cursor;
    if(!next?.updatedAt||!next?.nmID) throw new Error('WB не вернул курсор следующей страницы');
    const key=JSON.stringify([next.updatedAt,next.nmID]);if(seen.has(key)) throw new Error('WB повторил страницу карточек');seen.add(key);
    cursor={limit:100,updatedAt:next.updatedAt,nmID:next.nmID};await sleep(1500);
  }
  return [...found.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
