import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../../js/utils.js');
  await import('../../js/ui.js');
});

function makeContainer(columns, rows) {
  const { Spreadsheet } = globalThis;
  const div = document.createElement('div');
  div.className = 'spreadsheet';
  div.innerHTML = `
    <table>
      <thead><tr><th>#</th>${columns.map(c => `<th>${c.label}</th>`).join('')}<th></th></tr></thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = div.querySelector('tbody');
  rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="row-num">${idx + 1}</td>` +
      columns.map(c => {
        if (c.type === 'select') {
          const opts = (c.opts || []).map(o => `<option value="${o.v}">${o.l}</option>`).join('');
          return `<td><select data-key="${c.key}">${opts}</select></td>`;
        }
        return `<td><input type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}" data-key="${c.key}" value="${row[c.key] ?? ''}" /></td>`;
      }).join('') +
      '<td><button>×</button></td>';
    columns.forEach(c => {
      const el = tr.querySelector(`[data-key="${c.key}"]`);
      if (el && row[c.key] !== undefined) el.value = row[c.key];
    });
    tbody.appendChild(tr);
  });
  div._columns = columns;
  return { div, Spreadsheet };
}

describe('Spreadsheet.getData', () => {
  it('returns parsed rows', () => {
    const columns = [
      { key: 'name', label: 'Name', req: true },
      { key: 'amount', label: 'Amount', type: 'number' }
    ];
    const { div, Spreadsheet } = makeContainer(columns, [{ name: 'Project A', amount: '1000' }]);
    const data = Spreadsheet.getData(div);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Project A');
    expect(data[0].amount).toBe(1000);
  });

  it('treats 0 as valid for required numeric fields', () => {
    const columns = [
      { key: 'rate', label: 'Rate', type: 'number', req: true }
    ];
    const { div, Spreadsheet } = makeContainer(columns, [{ rate: '0' }]);
    expect(() => Spreadsheet.getData(div)).not.toThrow();
    expect(Spreadsheet.getData(div)[0].rate).toBe(0);
  });

  it('throws when a required text field is empty', () => {
    const columns = [
      { key: 'name', label: 'Name', req: true },
      { key: 'amount', label: 'Amount', type: 'number' }
    ];
    const { div, Spreadsheet } = makeContainer(columns, [{ name: '', amount: '100' }]);
    expect(() => Spreadsheet.getData(div)).toThrow(/الحقول المطلوبة/);
  });

  it('skips completely empty rows', () => {
    const columns = [
      { key: 'name', label: 'Name' }
    ];
    const { div, Spreadsheet } = makeContainer(columns, [{ name: '' }, { name: 'Valid' }]);
    const data = Spreadsheet.getData(div);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Valid');
  });
});
