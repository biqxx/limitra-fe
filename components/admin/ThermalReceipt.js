'use client';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const money = (v, currency = 'NGN') => {
  const num = Number(v || 0);
  const sym = currency === 'NGN' ? 'NGN ' : `${currency} `;
  return `${sym}${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

function printHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }, 100);
  };
}

function downloadHtml(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function extractOrderMeta(rawOrder) {
  const orderNo = rawOrder?.number || `#${rawOrder?.id || ''}`;
  const currency = rawOrder?.currency || 'NGN';
  const addr = rawOrder?.shipping_address || {};
  const customerName =
    addr.recipient_name ||
    rawOrder?.user?.username ||
    rawOrder?.user?.name ||
    rawOrder?.contact_email ||
    rawOrder?.user?.email ||
    'Customer';
  const customerPhone = addr.phone || rawOrder?.user?.phone || '';
  const customerEmail = rawOrder?.contact_email || rawOrder?.user?.email || '';
  const addressParts = [
    addr.line1 || addr.address_line_1,
    addr.line2 || addr.address_line_2,
    addr.landmark ? `Near ${addr.landmark}` : '',
    [addr.city, addr.state].filter(Boolean).join(', '),
    addr.postal_code,
    addr.redstar_city_code ? `RedStar: ${addr.redstar_city_code}` : '',
  ].filter(Boolean);

  return {
    orderNo,
    currency,
    addr,
    customerName,
    customerPhone,
    customerEmail,
    addressParts,
    deliveryMethod: (rawOrder?.delivery_method || 'Standard').toUpperCase(),
    paymentMethod: (rawOrder?.payment_method || '—').toUpperCase(),
    paymentStatus: (rawOrder?.payment_status || rawOrder?.status || '—').toUpperCase(),
    items: Array.isArray(rawOrder?.items) ? rawOrder.items : [],
  };
}

export function buildThermalReceiptHtml(rawOrder, paperWidth = '80mm') {
  const is58 = paperWidth === '58mm';
  const pageSize = is58 ? '58mm' : '80mm';
  const bodyWidth = is58 ? '48mm' : '72mm';

  const {
    orderNo,
    currency,
    customerName,
    customerPhone,
    customerEmail,
    addressParts,
    deliveryMethod,
    paymentMethod,
    paymentStatus,
    items,
  } = extractOrderMeta(rawOrder);

  const subtotal = Number(rawOrder?.subtotal ?? 0);
  const discount = Number(rawOrder?.discount_total ?? 0);
  const shipping = Number(rawOrder?.shipping_total ?? 0);
  const credit = Number(rawOrder?.credit_total ?? 0);
  const netCash = Number(rawOrder?.total_amount ?? rawOrder?.grand_total ?? 0);
  const orderValue = Number(rawOrder?.order_total ?? (netCash + credit));

  const itemRows = items.length
    ? items.map((it) => {
        const name = esc(it.name || it.product_name || 'Item');
        const qty = Number(it.quantity || 1);
        const unit = Number(it.unit_price ?? it.price_at_purchase ?? 0);
        const line = Number(it.line_total ?? (unit * qty));
        const opts = Array.isArray(it.selected_options) && it.selected_options.length
          ? `<div class="sub">${esc(it.selected_options.map((o) => `${o.name || o.attribute || ''}: ${o.value || ''}`).join(', '))}</div>`
          : '';
        return `
          <tr>
            <td colspan="2" class="item-title">${name}${opts}</td>
          </tr>
          <tr>
            <td class="sub">${qty} x ${esc(money(unit, currency))}</td>
            <td class="right bold">${esc(money(line, currency))}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="2" class="sub">No line items recorded</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${esc(orderNo)}</title>
<style>
  @page { margin: 0; size: ${pageSize} auto; }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: ${is58 ? '11px' : '12px'};
    line-height: 1.25;
    color: #000000;
  }
  html, body {
    background: #ffffff;
    width: ${bodyWidth};
    margin: 0 auto;
    padding: 3mm 1mm;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .title { font-size: ${is58 ? '14px' : '16px'}; font-weight: bold; letter-spacing: 1px; }
  .sub { font-size: ${is58 ? '10px' : '11px'}; }
  .dash { border-top: 1px dashed #000000; margin: 5px 0; }
  .solid { border-top: 1px solid #000000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 1px 0; }
  .item-title { padding-top: 3px; word-break: break-word; }
  .grand td { font-size: ${is58 ? '13px' : '14px'}; font-weight: bold; padding-top: 3px; }
  .mt { margin-top: 6px; }
</style>
</head>
<body>
  <div class="center">
    <div class="title">LIMITRA</div>
    <div>Lagos, Nigeria</div>
    <div class="sub">support@limitra.com.ng</div>
  </div>

  <div class="dash"></div>

  <table>
    <tr><td>ORDER:</td><td class="right bold">${esc(orderNo)}</td></tr>
    <tr><td>DATE:</td><td class="right">${esc(fmtDateTime(rawOrder?.created_at))}</td></tr>
    <tr><td>STATUS:</td><td class="right">${esc(paymentStatus)}</td></tr>
    <tr><td>PAY BY:</td><td class="right">${esc(paymentMethod)}</td></tr>
  </table>

  <div class="dash"></div>

  <div class="bold">CUSTOMER</div>
  <div>${esc(customerName)}</div>
  ${customerPhone ? `<div class="sub">Tel: ${esc(customerPhone)}</div>` : ''}
  ${customerEmail ? `<div class="sub">${esc(customerEmail)}</div>` : ''}

  <div class="dash"></div>

  <div class="bold">DELIVERY</div>
  <div>Method: ${esc(deliveryMethod)}</div>
  <div>${addressParts.length ? esc(addressParts.join(', ')) : 'No delivery address'}</div>

  <div class="solid"></div>

  <table>
    <tr><td class="bold">ITEM</td><td class="right bold">AMOUNT</td></tr>
    <tr><td colspan="2"><div class="dash"></div></td></tr>
    ${itemRows}
  </table>

  <div class="solid"></div>

  <table>
    <tr><td>SUBTOTAL</td><td class="right">${esc(money(subtotal || orderValue, currency))}</td></tr>
    ${discount > 0 ? `<tr><td>COUPON/PROMO</td><td class="right">-${esc(money(discount, currency))}</td></tr>` : ''}
    <tr><td>SHIPPING</td><td class="right">${shipping === 0 ? 'FREE' : esc(money(shipping, currency))}</td></tr>
    ${credit > 0 ? `<tr><td>WALLET CREDIT</td><td class="right">-${esc(money(credit, currency))}</td></tr>` : ''}
    <tr><td colspan="2"><div class="dash"></div></td></tr>
    <tr class="grand"><td>ORDER TOTAL</td><td class="right">${esc(money(orderValue, currency))}</td></tr>
    ${credit > 0 ? `<tr><td>GATEWAY PAID</td><td class="right">${esc(money(netCash, currency))}</td></tr>` : ''}
  </table>

  <div class="dash"></div>

  <div class="center mt">
    <div>THANK YOU FOR SHOPPING WITH US</div>
    <div class="sub">${esc(orderNo)}</div>
  </div>
</body>
</html>`;
}

export function buildShippingLabelHtml(rawOrder) {
  const {
    orderNo,
    addr,
    customerName,
    customerPhone,
    addressParts,
    deliveryMethod,
    items,
  } = extractOrderMeta(rawOrder);

  const tracking = rawOrder?.tracking || {};
  const courier = (tracking.courier || deliveryMethod || 'STANDARD').toUpperCase();
  const waybill = tracking.tracking_number || orderNo;
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 1), 0) || Number(rawOrder?.items_count || 1);
  const cityBadge = addr.redstar_city_code || addr.city || addr.state || 'NG';

  const itemSummary = items.length
    ? items.map((it) => `${Number(it.quantity || 1)}x ${esc(it.name || it.product_name || 'Item')}`).join('<br />')
    : `${totalQty} item(s)`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Shipping Label ${esc(orderNo)}</title>
<style>
  @page { margin: 0; size: 100mm 150mm; }
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: 'Courier New', Courier, monospace;
    color: #000000;
  }
  html, body {
    width: 96mm;
    min-height: 144mm;
    margin: 2mm auto;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.3;
  }
  .label {
    border: 2px solid #000000;
    padding: 4mm;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
  .route-box {
    border: 2px solid #000000;
    padding: 2px 8px;
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
  }
  .hr { border-top: 2px solid #000000; margin: 3mm 0; }
  .dash { border-top: 1px dashed #000000; margin: 3mm 0; }
  .hdr { font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-bottom: 2px; }
  .to-name { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
  .to-addr { font-size: 13px; word-break: break-word; }
  .barcode-box {
    border: 1px solid #000000;
    padding: 3mm 2mm;
    text-align: center;
    margin-top: 2mm;
  }
  .barcode-bars {
    font-size: 20px;
    font-weight: bold;
    letter-spacing: 3px;
  }
  .small { font-size: 10px; }
</style>
</head>
<body>
  <div class="label">
    <div class="row">
      <div>
        <div class="brand">LIMITRA</div>
        <div class="small">SHIPPING LABEL</div>
      </div>
      <div class="route-box">${esc(cityBadge)}</div>
    </div>

    <div class="hr"></div>

    <div class="hdr">FROM:</div>
    <div>Limitra Fulfilment</div>
    <div class="small">Lagos, Nigeria · support@limitra.com.ng</div>

    <div class="dash"></div>

    <div class="hdr">SHIP TO:</div>
    <div class="to-name">${esc(customerName)}</div>
    ${customerPhone ? `<div class="to-addr">TEL: ${esc(customerPhone)}</div>` : ''}
    <div class="to-addr">${addressParts.length ? esc(addressParts.join(', ')) : 'No delivery address'}</div>

    <div class="hr"></div>

    <div class="row">
      <div>
        <div class="hdr">ORDER #</div>
        <div><b>${esc(orderNo)}</b></div>
      </div>
      <div style="text-align:right">
        <div class="hdr">METHOD / COURIER</div>
        <div><b>${esc(courier)}</b></div>
      </div>
    </div>

    <div class="dash"></div>

    <div class="row">
      <div>
        <div class="hdr">ITEMS (${totalQty})</div>
        <div class="small">${itemSummary}</div>
      </div>
    </div>

    <div class="hr"></div>

    <div class="barcode-box">
      <div class="hdr">${tracking.tracking_number ? 'WAYBILL / TRACKING #' : 'ORDER REFERENCE'}</div>
      <div class="barcode-bars">*${esc(waybill)}*</div>
      <div class="small">${esc(fmtDateTime(rawOrder?.created_at))}</div>
    </div>
  </div>
</body>
</html>`;
}

export function printThermalReceipt(rawOrder, paperWidth = '80mm') {
  printHtml(buildThermalReceiptHtml(rawOrder, paperWidth));
}

export function downloadThermalReceipt(rawOrder, paperWidth = '80mm') {
  const orderNo = String(rawOrder?.number || rawOrder?.id || 'order').replace(/[^a-zA-Z0-9_-]/g, '');
  downloadHtml(buildThermalReceiptHtml(rawOrder, paperWidth), `receipt-${orderNo}-${paperWidth}.html`);
}

export function printShippingLabel(rawOrder) {
  printHtml(buildShippingLabelHtml(rawOrder));
}

export function downloadShippingLabel(rawOrder) {
  const orderNo = String(rawOrder?.number || rawOrder?.id || 'order').replace(/[^a-zA-Z0-9_-]/g, '');
  downloadHtml(buildShippingLabelHtml(rawOrder), `shipping-label-${orderNo}.html`);
}
