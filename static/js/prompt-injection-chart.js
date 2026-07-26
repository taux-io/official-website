// Chart configuration for the prompt-injection page.
//
// Extracted from an inline <script>. The site's Content-Security-Policy allows
// scripts only from its own origin and jsdelivr, with no 'unsafe-inline' —
// inline blocks are the largest opening in a script policy, and one chart is
// not a reason to leave it open. As an inline block this silently did not run:
// Chart.js loaded and nothing drew.

document.addEventListener('DOMContentLoaded', function () {
        const ctx = document.getElementById('jailbreakChart').getContext('2d');

        // Dark Theme (Glasswing)
        // Read from the token layer so a palette change carries the chart with
        // it. This file held the last two hues on the site — the monochrome
        // migration compared class attributes and never looked inside
        // JavaScript — and the first pass at fixing that replaced the series
        // colours while leaving the axes, grid, tooltip and legend on
        // hand-picked rgba values. They are all tokens now.
        const token = (name, fallback) =>
            getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
        const INK_RGB = token('--text-primary-rgb', '255 255 255');
        const MUTED_RGB = token('--text-muted-rgb', '138 138 145');
        const LINE_RGB = token('--line-rgb', '255 255 255');
        const SURFACE_RAISED_RGB = token('--surface-raised-rgb', '15 15 17');

        const ink = (a) => `rgb(${INK_RGB} / ${a})`;
        const line = (a) => `rgb(${LINE_RGB} / ${a})`;
        const INK = `rgb(${INK_RGB})`;
        const MUTED = `rgb(${MUTED_RGB})`;

        Chart.defaults.color = ink(0.5);
        Chart.defaults.borderColor = line(0.08);
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                datasets: [
                    {
                        label: '大型語言模型 (高風險)',
                        data: [5, 15, 30, 50, 70, 85, 92, 95, 98, 99, 100],
                        // The two series are told apart by weight and by a solid
                        // versus dashed stroke rather than by hue. The palette
                        // has no colour in it, and the legend labels already say
                        // which line is which.
                        borderColor: INK,
                        backgroundColor: INK,
                        borderWidth: 2,
                        tension: 0.4,
                        pointRadius: 2,
                        pointHoverRadius: 6,
                        fill: false
                    },
                    {
                        label: '微調小型模型',
                        data: [2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
                        borderColor: MUTED,
                        backgroundColor: MUTED,
                        borderWidth: 2,
                        borderDash: [5, 4],
                        tension: 0.4,
                        pointRadius: 2,
                        pointHoverRadius: 6,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: ink(0.7),
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: `rgb(${SURFACE_RAISED_RGB} / 0.95)`,
                        titleColor: INK,
                        bodyColor: ink(0.7),
                        borderColor: line(0.2),
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: '攻擊成功率 (%)', color: ink(0.5), padding: 10 },
                        grid: { color: line(0.08) },
                        border: { display: false }
                    },
                    x: {
                        title: { display: true, text: '偽造範例數量 (Shots)', color: ink(0.5), padding: 10 },
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    });
