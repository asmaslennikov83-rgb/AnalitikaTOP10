import {readFile} from 'node:fs/promises';
import {periods} from './core.mjs';
import {collect} from './wb.mjs';
import {workbook} from './excel.mjs';
import {discoverSubjects} from './subjects.mjs';
import {diagnose} from './diagnostics.mjs';
const version='0.3.1';
const token=process.env.TELEGRAM_BOT_TOKEN;
const allowed=new Set((process.env.TELEGRAM_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
if(!token||!allowed.size) throw new Error('Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_USER_IDS в .env');
const cabinets=JSON.parse(await readFile(new URL('../cabinets.json',import.meta.url),'utf8'));
if(!cabinets.length||new Set(cabinets.map(c=>c.id)).size!==cabinets.length||cabinets.some(c=>!/^\w+$/.test(c.id)||!c.name||!/^WB_API_TOKEN_\d+$/.test(c.contentTokenEnv)||!Array.isArray(c.subjects)||c.subjects.some(s=>!Number.isInteger(s.id)||s.id<=0||!s.name))) throw new Error('Проверьте cabinets.json');
async function telegram(method,body) {
  let r;try{r=await fetch(`https://api.telegram.org/bot${token}/${method}`,body instanceof FormData?{method:'POST',body,signal:AbortSignal.timeout(90000)}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw new Error('Нет связи с Telegram');}
  const data=await r.json();if(!data.ok) throw new Error(`Telegram отклонил ${method}`);return data.result;
}
const send=(chat_id,text)=>telegram('sendMessage',{chat_id,text});
let busy=false;
async function handle(message) {
  if(message.chat.type!=='private'||!allowed.has(String(message.from?.id))) return;
  const chat=message.chat.id,text=message.text||'';
  if(text.startsWith('/start')||text.startsWith('/help')) return send(chat,`Версия сборки: ${version}\n/check — проверить доступ WB к сравнению и собственной воронке\n/subjects — получить предметы через API\n/report — пока недоступен: проверяем источник данных`);
  if(text==='/check') {
    if(busy)return send(chat,'Запрос уже выполняется. Дождитесь завершения.');
    busy=true;
    try {
      await send(chat,'Проверяю доступ отдельно для каждого кабинета. Токены не выводятся.');
      const d=new Date();d.setTime(d.getTime()-86400000);
      const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
      for(const cabinet of cabinets) {
        try {const key=process.env[cabinet.contentTokenEnv];const subjects=await discoverSubjects(key);
          if(!subjects.length){await send(chat,`${cabinet.name}: нет активных карточек для проверки`);continue;}
          await send(chat,`${cabinet.name}, предмет ${subjects[0].id}, ${date}:\n${await diagnose(key,subjects[0].id,date)}`);
        }catch{await send(chat,`${cabinet.name}: не удалось получить предмет для проверки. Проверьте /subjects.`);}
      }
    }finally{busy=false;}return;
  }
  if(text==='/subjects') {
    if(busy) return send(chat,'Запрос уже выполняется. Дождитесь завершения.');
    busy=true;
    try {for(const cabinet of cabinets) {
      try {const subjects=await discoverSubjects(process.env[cabinet.contentTokenEnv]);
        const lines=[`${cabinet.name}:`,...subjects.map(s=>`${s.id}: ${s.name}`)];
        if(!subjects.length) lines.push('В кабинете нет активных карточек');
        let chunk='';for(const line of lines) {if(chunk.length+line.length>3500){await send(chat,chunk);chunk='';}chunk+=line+'\n';}if(chunk)await send(chat,chunk);
      }catch(error){await send(chat,`${cabinet.name}: ${error.message}`);}
    }}finally{busy=false;}return;
  }
  if(!/^\/report(?:\s|$)/.test(text)) return;
  return send(chat,'В этой диагностической сборке отчёт ещё не подключён. Выполните /check для проверки API WB.');
}
let offset=0;
console.log('Бот запущен. Доступ ограничен указанными Telegram ID.');
while(true) {
  try {
    const updates=await telegram('getUpdates',{offset,timeout:30,allowed_updates:['message']});
    for(const update of updates) {offset=update.update_id+1;if(update.message) handle(update.message).catch(()=>console.error('Не удалось обработать сообщение'));}
  }catch{console.error('Ошибка связи Telegram. Повтор через 5 секунд.');await new Promise(r=>setTimeout(r,5000));}
}


