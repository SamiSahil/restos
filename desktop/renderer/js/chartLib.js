const ChartLib = {
  theme: {
    grid: '#2A2D37',
    axisText: '#6B7280',
    labelText: '#9CA3AF',
    pointInner: '#0F1117',
    centerText: '#F1F2F4',
    font: 'Inter, sans-serif'
  },

  defaults: {
    height: 220,
    padding: { top: 20, right: 20, bottom: 40, left: 55 },
    gridLines: 5
  },

  getCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return { canvas, ctx };
  },

  setupResponsiveCanvas(canvas, ctx, { width, height }) {
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  },

  getChartArea(canvas, height = this.defaults.height, paddingOverride = {}) {
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const padding = { ...this.defaults.padding, ...paddingOverride };

    return {
      width,
      height,
      padding,
      chartWidth: width - padding.left - padding.right,
      chartHeight: height - padding.top - padding.bottom
    };
  },

  clear(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
  },

  getSafeMax(data, multiplier = 1) {
    return Math.max(...data, 1) * multiplier;
  },

getFormatter(formatter) {
  if (typeof formatter === 'function') return formatter;
  return (value) => {
    const symbol = window.APP_CONFIG?.CURRENCY_SYMBOL || '৳';
    return `${symbol}${Math.round(value)}`;
  };
},

  drawGridAndYAxis(ctx, {
    width,
    padding,
    chartHeight,
    maxValue,
    gridLines = this.defaults.gridLines,
    formatter
  }) {
    const format = this.getFormatter(formatter);

    ctx.strokeStyle = this.theme.grid;
    ctx.lineWidth = 1;
    ctx.fillStyle = this.theme.axisText;
    ctx.font = `11px ${this.theme.font}`;
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      const val = maxValue - (maxValue / gridLines) * i;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(format(val), padding.left - 8, y + 4);
    }
  },

  drawXAxisLabels(ctx, labels, {
    height,
    padding,
    getX,
    fontSize = 11,
    color = null
  }) {
    ctx.fillStyle = color || this.theme.labelText;
    ctx.font = `${fontSize}px ${this.theme.font}`;
    ctx.textAlign = 'center';

    labels.forEach((label, i) => {
      ctx.fillText(String(label), getX(i), height - padding.bottom + 18);
    });
  },

  createVerticalFade(ctx, x1, y1, x2, y2, color, startAlpha = '33', endAlpha = '00') {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    gradient.addColorStop(0, `${color}${startAlpha}`);
    gradient.addColorStop(1, `${color}${endAlpha}`);
    return gradient;
  },

  drawRoundedBar(ctx, x, y, width, bottomY, fillStyle) {
    const radius = Math.min(5, width / 2);

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, bottomY);
    ctx.lineTo(x, bottomY);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
  },

  barChart(canvasId, options = {}) {
    const {
      labels = [],
      data = [],
      color = '#E85D24',
      height,
      padding,
      gridLines,
      formatter
    } = options;

    const canvasObj = this.getCanvas(canvasId);
    if (!canvasObj || !labels.length || !data.length) return;

    const { canvas, ctx } = canvasObj;
    const finalHeight = parseInt(canvas.getAttribute('height') || height || this.defaults.height, 10);
    const area = this.getChartArea(canvas, finalHeight, padding);

    this.setupResponsiveCanvas(canvas, ctx, {
      width: area.width,
      height: area.height
    });

    this.clear(ctx, area.width, area.height);

    const maxValue = this.getSafeMax(data);
    const step = area.chartHeight / maxValue;
    const bottomY = area.padding.top + area.chartHeight;

    this.drawGridAndYAxis(ctx, {
      width: area.width,
      padding: area.padding,
      chartHeight: area.chartHeight,
      maxValue,
      gridLines: gridLines || this.defaults.gridLines,
      formatter
    });

    const barWidth = Math.min(40, (area.chartWidth / labels.length) * 0.6);
    const gap = area.chartWidth / labels.length;

    labels.forEach((label, i) => {
      const x = area.padding.left + gap * i + (gap - barWidth) / 2;
      const barHeight = (data[i] || 0) * step;
      const y = bottomY - barHeight;

      const gradient = this.createVerticalFade(
        ctx,
        x,
        y,
        x,
        bottomY,
        color,
        '',
        '44'
      );

      this.drawRoundedBar(ctx, x, y, barWidth, bottomY, gradient);
    });

    this.drawXAxisLabels(ctx, labels, {
      height: area.height,
      padding: area.padding,
      getX: (i) => {
        const x = area.padding.left + gap * i + (gap - barWidth) / 2;
        return x + barWidth / 2;
      }
    });
  },

  lineChart(canvasId, options = {}) {
    const {
      labels = [],
      data = [],
      color = '#E85D24',
      height,
      padding,
      gridLines,
      formatter,
      maxMultiplier = 1.1
    } = options;

    const canvasObj = this.getCanvas(canvasId);
    if (!canvasObj || !labels.length || !data.length) return;

    const { canvas, ctx } = canvasObj;
    const finalHeight = parseInt(canvas.getAttribute('height') || height || this.defaults.height, 10);
    const area = this.getChartArea(canvas, finalHeight, padding);

    this.setupResponsiveCanvas(canvas, ctx, {
      width: area.width,
      height: area.height
    });

    this.clear(ctx, area.width, area.height);

    const maxValue = this.getSafeMax(data, maxMultiplier);

    this.drawGridAndYAxis(ctx, {
      width: area.width,
      padding: area.padding,
      chartHeight: area.chartHeight,
      maxValue,
      gridLines: gridLines || this.defaults.gridLines,
      formatter
    });

    const points = data.map((value, i) => ({
      x: area.padding.left + (area.chartWidth / Math.max(labels.length - 1, 1)) * i,
      y: area.padding.top + area.chartHeight - ((value || 0) / maxValue) * area.chartHeight
    }));

    if (!points.length) return;

    const fillGradient = this.createVerticalFade(
      ctx,
      0,
      area.padding.top,
      0,
      area.padding.top + area.chartHeight,
      color,
      '33',
      '00'
    );

    ctx.beginPath();
    ctx.moveTo(points[0].x, area.padding.top + area.chartHeight);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, area.padding.top + area.chartHeight);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });

    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = this.theme.pointInner;
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    this.drawXAxisLabels(ctx, labels, {
      height: area.height,
      padding: area.padding,
      getX: (i) => area.padding.left + (area.chartWidth / Math.max(labels.length - 1, 1)) * i
    });
  },

  pieChart(canvasId, options = {}) {
    const {
      labels = [],
      data = [],
      colors = ['#E85D24', '#22C55E', '#3B82F6'],
      maxSize = 260,
      centerLabel = 'Total Items',
      centerValueFormatter = (value) => String(value)
    } = options;

    const canvasObj = this.getCanvas(canvasId);
    if (!canvasObj || !labels.length || !data.length) return;

    const { canvas, ctx } = canvasObj;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement.getBoundingClientRect().width, maxSize);
    const height = size + 80;

    canvas.width = size * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    this.clear(ctx, size, height);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const innerRadius = radius * 0.55;
    const total = data.reduce((sum, value) => sum + value, 0) || 1;

    let startAngle = -Math.PI / 2;

    data.forEach((value, i) => {
      const sliceAngle = ((value || 0) / total) * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(
        cx + innerRadius * Math.cos(startAngle),
        cy + innerRadius * Math.sin(startAngle)
      );
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      startAngle += sliceAngle;
    });

    ctx.fillStyle = this.theme.centerText;
    ctx.font = `bold 18px ${this.theme.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(centerValueFormatter(total), cx, cy - 2);

    ctx.fillStyle = this.theme.axisText;
    ctx.font = `11px ${this.theme.font}`;
    ctx.fillText(centerLabel, cx, cy + 14);

    const legendY = size + 10;
    const legendCols = Math.min(labels.length, 3);
    const colWidth = size / legendCols;

    labels.forEach((label, i) => {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const x = col * colWidth + 4;
      const y = legendY + row * 18;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(x + 5, y + 5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.theme.labelText;
      ctx.font = `10px ${this.theme.font}`;
      ctx.textAlign = 'left';

      const pct = total > 0 ? Math.round(((data[i] || 0) / total) * 100) : 0;
      ctx.fillText(`${label} (${pct}%)`, x + 14, y + 9);
    });
  },

  sparkline(canvasId, options = {}) {
    const {
      data = [],
      color = '#E85D24',
      height = 60,
      strokeWidth = 2
    } = options;

    const canvasObj = this.getCanvas(canvasId);
    if (!canvasObj || !data.length) return;

    const { canvas, ctx } = canvasObj;
    const rect = canvas.parentElement.getBoundingClientRect();
    const width = rect.width;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    this.clear(ctx, width, height);

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;

    const points = data.map((value, i) => ({
      x: (width / Math.max(data.length - 1, 1)) * i,
      y: height - ((value - min) / range) * height
    }));

    const fillGradient = this.createVerticalFade(ctx, 0, 0, 0, height, color, '22', '00');

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = fillGradient;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });

    ctx.stroke();
  },

  destroy(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};