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
        // it. This file previously held the only two colour values left on the
        // site — the monochrome migration compared class attributes and never
        // looked inside JavaScript.
        const token = (name, fallback) =>
            getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
        const INK = `rgb(${token('--text-primary-rgb', '255 255 255')})`;
        const MUTED = `rgb(${token('--text-muted-rgb', '138 138 145')})`;

        Chart.defaults.color = 'rgba(255,255,255,0.50)';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
        Chart.defaults.font.family = "'D-DIN', 'PingFang TC', 'Microsoft JhengHei', sans-serif";

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
                            color: 'rgba(255,255,255,0.70)',
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 15, 13, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: 'rgba(255,255,255,0.70)',
                        borderColor: 'rgba(255,255,255,0.10)',
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
                        title: { display: true, text: '攻擊成功率 (%)', color: 'rgba(255,255,255,0.50)', padding: 10 },
                        grid: { color: 'rgba(255,255,255,0.06)' },
                        border: { display: false }
                    },
                    x: {
                        title: { display: true, text: '偽造範例數量 (Shots)', color: 'rgba(255,255,255,0.50)', padding: 10 },
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
