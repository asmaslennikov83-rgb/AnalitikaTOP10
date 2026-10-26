import {readFile} from 'node:fs/promises';
import {periods} from './core.mjs';
import {collect} from './wb.mjs';
import {workbook} from './excel.mjs';
import {discoverSubjects} from './subjects.mjs';
const token=process.env.TELEGRAM_BOT_TOKEN;
const allowed=new Set((process.env.TELEGRAM_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
if(!token||!allowed.size) throw new Error('Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_USER_IDS в .env');
const cabinets=JSON.parse(await readFile(new URL('../cabinets.json',import.meta.url),'utf8'));
if(!cabinets.length||new Set(cabinets.map(c=>c.id)).size!==cabinets.length||cabinets.some(c=>!/^\w+$/.test(c.id)||!c.name||!/^WB_AUTHORIZEV3_\d+$/.test(c.tokenEnv)||!Array.isArray(c.subjects)||c.subjects.some(s=>!Number.isInteger(s.id)||s.id<=0||!s.name))) throw new Error('Проверьте cabinets.json');
async function telegram(method,body) {
  let r;try{r=await fetch(`https://api.telegram.org/bot${token}/${method}`,body instanceof FormData?{method:'POST',body,signal:AbortSignal.timeout(90000)}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});}catch{throw new Error('Нет связи с Telegram');}
  const data=await r.json();if(!data.ok) throw new Error(`Telegram отклонил ${method}`);return data.result;
}
const send=(chat_id,text)=>telegram('sendMessage',{chat_id,text});
let busy=false;
async function handle(message) {
  if(message.chat.type!=='private'||!allowed.has(String(message.from?.id))) return;
  const chat=message.chat.id,text=message.text||'';
  if(text.startsWith('/start')||text.startsWith('/help')) return send(chat,'/report — Excel с начала периода из настроек\n/report 2026-01 — с указанного месяца\n/subjects — список предметов\nЗакрытые месяцы и ежедневная динамика текущего месяца по вчера.');
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
  if(busy) return send(chat,'Отчёт уже формируется. Дождитесь завершения.');
  busy=true;
  try {
    const arg=text.trim().split(/\s+/)[1];
    if(arg&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(arg)) throw new Error('Укажите месяц: /report 2026-01');
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const start=arg?arg+'-01':process.env.REPORT_START||today.slice(0,7)+'-01';
    const plan=periods(start,today);
    if(!plan.length) throw new Error('За выбранный период ещё нет завершённых дней');
    if(plan.filter(p=>p.kind==='month').length>24) throw new Error('Выберите период не более 24 месяцев');
    for(const cabinet of cabinets) {
      try {
        const subjects=await discoverSubjects(process.env[cabinet.contentTokenEnv]);
        if(!subjects.length) throw new Error('В кабинете нет активных карточек товаров');
        const wbToken=process.env[cabinet.tokenEnv];
        if(!wbToken) throw new Error(`Заполните ${cabinet.tokenEnv} в .env`);
        await send(chat,`${cabinet.name}: найдено ${subjects.length} предметов через API. Формирую отчёт за ${plan.length} периодов.`);
        const records=await collect(subjects,plan,wbToken);
        const buffer=await workbook(records,today,cabinet.name);
        if(buffer.length>49*1024*1024) throw new Error('Файл слишком большой. Уменьшите период.');
        const form=new FormData();form.set('chat_id',String(chat));form.set('caption',cabinet.name);form.set('document',new Blob([buffer]),`WB-${cabinet.id}-${today}.xlsx`);
        await telegram('sendDocument',form);
      } catch(error) {await send(chat,`${cabinet.name}: отчёт не сформирован. ${error.message}`);}
    }
  } catch(error) {await send(chat,`Не удалось сформировать полный отчёт: ${error.message}`);} finally {busy=false;}
}
let offset=0;
console.log('Бот запущен. Доступ ограничен указанными Telegram ID.');
while(true) {
  try {
    const updates=await telegram('getUpdates',{offset,timeout:30,allowed_updates:['message']});
    for(const update of updates) {offset=update.update_id+1;if(update.message) handle(update.message).catch(()=>console.error('Не удалось обработать сообщение'));}
  }catch{console.error('Ошибка связи Telegram. Повтор через 5 секунд.');await new Promise(r=>setTimeout(r,5000));}
}
