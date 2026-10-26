export function periods(start, today) {
  if (!/^\d{4}-\d{2}-01$/.test(start) || !Number.isFinite(Date.parse(start))) throw new Error('Начало периода должно быть первым числом месяца: ГГГГ-ММ-01');
  const until = new Date(today+'T00:00:00Z'); until.setUTCDate(until.getUTCDate()-1);
  const result=[];
  for(let d=new Date(start+'T00:00:00Z'); d<=until; d.setUTCMonth(d.getUTCMonth()+1)) {
    const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
    const stop=end<until?end:until;
    result.push({start:d.toISOString().slice(0,10),end:stop.toISOString().slice(0,10),kind:'month'});
  }
  const current=new Date(today+'T00:00:00Z'); current.setUTCDate(1);
  if(current>=new Date(start+'T00:00:00Z')) for(let d=current;d<=until;d.setUTCDate(d.getUTCDate()+1)) {
    const date=d.toISOString().slice(0,10); result.push({start:date,end:date,kind:'day'});
  }
  return result;
}
export const groups={seller:'У вас',marketAverage:'Среднее WB',marketMedian:'Медиана WB',topSellers:'Топ-5%',closeSellers:'Похожие 5%'};
export const metrics={viewCount:'Показы',openCardCount:'Переходы',addToCartCount:'Корзины',addToWishlistCount:'Отложенные',orderCount:'Заказы, шт',orderSum:'Заказы, ₽',buyoutCount:'Выкупы, шт',buyoutSum:'Выкупы, ₽',buyoutPercent:'Выкуп, % WB',viewToOpenConversion:'CTR, % WB',openToCartConversion:'В корзину, % WB',cartToOrderConversion:'В заказ, % WB'};
export function validateResponse(body) {
  if(body?.error || !body?.data?.chart?.seller || !body?.data?.subjectSellers) throw new Error('WB вернул ошибку или изменил структуру отчёта');
  return body.data;
}
export function safeCell(value) { return typeof value==='string' && /^[=+@-]/.test(value)?"'"+value:value; }
export function sheetName(name,used) {
  const base=name.replace(/[\\/*?:\[\]]/g,' ').replace(/^'+|'+$/g,'').trim() || 'Предмет';
  let value=base.slice(0,31),i=1;
  while(used.has(value.toLowerCase())) { const suffix=' '+(++i);value=base.slice(0,31-suffix.length)+suffix; }
  used.add(value.toLowerCase());return value;
}
