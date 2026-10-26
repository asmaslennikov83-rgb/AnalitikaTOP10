import ExcelJS from 'exceljs';
import {groups,metrics,safeCell,sheetName} from './core.mjs';
export async function workbook(records,today) {
  const book=new ExcelJS.Workbook();book.creator='WB Telegram Bot';const used=new Set();
  for(const id of new Set(records.map(r=>r.subject.id))) {
    const items=records.filter(r=>r.subject.id===id), subject=items[0].subject;
    const ws=book.addWorksheet(sheetName(subject.name,used));
    ws.addRow([safeCell(subject.name),'Предмет WB',id,'Сформировано',today]);
    ws.addRow(['Месяцы — фактические границы запроса. Текущий месяц по вчера. Дневные строки — отдельные запросы.']);
    ws.addRow(['Суммы продавцов из списков приблизительные. Выкуп и конверсии сохранены как вернул WB.']);
    ws.addRow(['Названия не являются идентификаторами продавцов. Состав лидеров меняется между периодами.']);
    ws.addRow(['Тип','Начало','Конец','Группа',...Object.values(metrics)]);
    for(const {period:p,data} of items) for(const [key,label] of Object.entries(groups)) {
      const values=p.kind==='month'?data.chart[key]?.byMonth:data.chart[key]?.byDay;
      if(!values?.length) {ws.addRow([p.kind,p.start,p.end,label,'Нет данных WB']);continue;}
      if(values.length!==1) throw new Error('Неожиданное число периодов WB; выгрузка остановлена во избежание неверного итога');
      ws.addRow([p.kind==='month'?'Месяц':'День',p.start,p.end,label,...Object.keys(metrics).map(k=>values[0][k]??null)]);
    }
    ws.addRow([]);
    ws.addRow(['Тип','Начало','Конец','Список','Место WB','Продавец','Наш магазин','Заказы, шт','Заказы, ₽ (≈)']);
    for(const {period:p,data} of items) for(const [key,label] of [['top','Лидеры'],['similar','Схожие']]) {
      for(const seller of data.subjectSellers[key]??[]) ws.addRow([p.kind==='month'?'Месяц':'День',p.start,p.end,label,seller.rankPosition??null,safeCell(seller.name),seller.isCurrent?'Да':'Нет',seller.orderCount??null,seller.orderSum??null]);
    }
    ws.addRow([]); ws.addRow(['Тип','Начало','Конец','Все заказы предмета, шт','Все заказы предмета, ₽ (≈)','Динамика суммы, % WB','effectiveness.percent (смысл не подтверждён)']);
    for(const {period:p,data} of items) ws.addRow([p.kind,p.start,p.end,data.effectiveness?.orders?.count??null,data.effectiveness?.orders?.sum??null,data.effectiveness?.orders?.dynamicsSum??null,data.effectiveness?.percent??null]);
    ws.views=[{state:'frozen',ySplit:5}];ws.columns.forEach((c,i)=>c.width=i===5?38:22);
    ws.eachRow(row=>{row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};});});
    ws.getRow(5).font={bold:true};
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
