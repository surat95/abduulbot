import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { parseIncome, IncomeParseError } from '../src/cliniter/parse.ts';
import { parseAmount, formatBaht, normaliseDigits } from '../src/util/number.ts';

describe('parseAmount', () => {
  it('อ่านตัวเลขที่มีคอมมาและสัญลักษณ์เงินบาท', () => {
    assert.equal(parseAmount('฿ 12,345.50'), 12345.5);
    assert.equal(parseAmount('12,345'), 12345);
    assert.equal(parseAmount('  8,900.00 บาท '), 8900);
  });

  it('อ่านเลขไทย', () => {
    assert.equal(normaliseDigits('๑๒,๓๔๕'), '12,345');
    assert.equal(parseAmount('๑๒,๓๔๕.๕๐'), 12345.5);
  });

  it('ถือว่าวงเล็บคือค่าติดลบ', () => {
    assert.equal(parseAmount('(1,200.00)'), -1200);
  });

  it('รองรับรูปแบบยุโรป 12.345,50', () => {
    assert.equal(parseAmount('12.345,50'), 12345.5);
    assert.equal(parseAmount('1.234.567,89'), 1234567.89);
  });

  it('แยกแยะ "12,345" (หลักพัน) ออกจาก "12,50" (ทศนิยมยุโรป)', () => {
    assert.equal(parseAmount('12,345'), 12345);
    assert.equal(parseAmount('1,234,567'), 1234567);
    assert.equal(parseAmount('12,50'), 12.5);
  });

  it('คืน null เมื่อไม่มีตัวเลข', () => {
    assert.equal(parseAmount('รวมทั้งสิ้น'), null);
    assert.equal(parseAmount(''), null);
    assert.equal(parseAmount('-'), null);
  });
});

describe('formatBaht', () => {
  it('ฟอร์แมตเป็นเงินบาทพร้อมทศนิยมสองตำแหน่ง', () => {
    assert.equal(formatBaht(12345.5), '12,345.50 บาท');
    assert.equal(formatBaht(0), '0.00 บาท');
  });
});

describe('parseIncome', () => {
  it('หายอดรวมจากแถวที่เขียนว่า "รวมทั้งสิ้น"', () => {
    const html = `
      <table>
        <tr><th>รายการ</th><th>จำนวนเงิน</th></tr>
        <tr><td>เงินสด</td><td>5,000.00</td></tr>
        <tr><td>บัตรเครดิต</td><td>3,200.50</td></tr>
        <tr><td>รวมทั้งสิ้น</td><td>8,200.50</td></tr>
      </table>`;
    const result = parseIncome(html);
    assert.equal(result.total, 8200.5);
    assert.match(result.source, /^keyword:/);
  });

  it('ดึงรายการย่อยออกมาด้วย แต่ไม่นับแถวยอดรวม', () => {
    const html = `
      <table>
        <tr><td>เงินสด</td><td>5,000.00</td></tr>
        <tr><td>บัตรเครดิต</td><td>3,200.50</td></tr>
        <tr><td>รวมทั้งสิ้น</td><td>8,200.50</td></tr>
      </table>`;
    const result = parseIncome(html);
    assert.deepEqual(result.breakdown, [
      { label: 'เงินสด', amount: 5000 },
      { label: 'บัตรเครดิต', amount: 3200.5 },
    ]);
  });

  it('ไม่ใส่แถวที่ไม่ใช่จำนวนเงินลงในรายการย่อย', () => {
    const html = `
      <table>
        <tr><td>เงินสด</td><td>5,000.00</td></tr>
        <tr><td>รวมจำนวนคนไข้</td><td>23</td></tr>
        <tr><td>รวมทั้งสิ้น</td><td>5,000.00</td></tr>
      </table>`;
    assert.deepEqual(parseIncome(html).breakdown, [{ label: 'เงินสด', amount: 5000 }]);
  });

  it('ไม่หยิบ "รวมจำนวนคนไข้" มาเป็นยอดเงิน', () => {
    const html = `
      <table>
        <tr><td>รวมจำนวนคนไข้</td><td>17</td></tr>
        <tr><td>รวมทั้งสิ้น</td><td>24,500.00</td></tr>
      </table>`;
    assert.equal(parseIncome(html).total, 24500);
  });

  it('อ่าน total จากการ์ดสรุปที่ไม่ได้อยู่ในตาราง', () => {
    const html = `
      <div class="card">
        <div class="card-body"><span class="label">ยอดรวม</span><span class="value">฿ 19,850.00</span></div>
      </div>`;
    assert.equal(parseIncome(html).total, 19850);
  });

  it('ใช้ selector ที่ตั้งเองเป็นอันดับแรก', () => {
    const html = `
      <div id="grand" >99,999.00</div>
      <table><tr><td>รวมทั้งสิ้น</td><td>1.00</td></tr></table>`;
    const result = parseIncome(html, '#grand');
    assert.equal(result.total, 99999);
    assert.equal(result.source, 'selector:#grand');
  });

  it('ถ้า selector ที่ตั้งไว้หาไม่เจอ ให้โยน error ที่บอกสาเหตุชัดเจน', () => {
    assert.throws(
      () => parseIncome('<div>ไม่มีอะไร</div>', '#ไม่มีจริง'),
      (error: unknown) => error instanceof IncomeParseError,
    );
  });

  it('ถ้าไม่มีคำว่ารวม ให้บวกคอลัมน์ตัวเลขคอลัมน์สุดท้ายแทน', () => {
    const html = `
      <table>
        <tr><th>คนไข้</th><th>ยอด</th></tr>
        <tr><td>คนไข้ ก</td><td>1,000.00</td></tr>
        <tr><td>คนไข้ ข</td><td>2,500.00</td></tr>
      </table>`;
    const result = parseIncome(html);
    assert.equal(result.total, 3500);
    assert.match(result.source, /^sum-column:/);
  });

  it('โยน IncomeParseError เมื่ออ่านอะไรไม่ได้เลย', () => {
    assert.throws(
      () => parseIncome('<html><body><p>ไม่มีข้อมูล</p></body></html>'),
      (error: unknown) => error instanceof IncomeParseError,
    );
  });
});
