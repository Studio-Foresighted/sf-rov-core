export class SkillIcons {
    constructor() {
        this.palette = {
            '.': null,
            'R': '#8a0000', 'r': '#ff0000', 'O': '#ff8800', 'Y': '#ffff00', // Fire
            'B': '#000088', 'b': '#0000ff', 'C': '#00ffff', 'W': '#ffffff', // Ice/Magic
            'G': '#444444', 'g': '#888888', 'S': '#cccccc', // Steel/Grey
            'D': '#4a3b2a', 'd': '#8b4513', // Dirt/Brown
        };

        this.icons = {
            'warrior_q': [ // Dash (Boot)
                '........',
                '.....dd.',
                '....dDD.',
                '...dDD..',
                '..dDD...',
                '.dDDDD..',
                'dDDDD...',
                '........'
            ],
            'warrior_w': [ // Spin (Axe)
                '..SS....',
                '.S..S...',
                'S....S..',
                'S.gg.S..',
                '.SggS...',
                '..dd....',
                '..dd....',
                '..dd....'
            ],
            'mage_q': [ // Fireball
                '....O...',
                '...OrO..',
                '..OrrO..',
                '.OrrrO..',
                '..OrrO..',
                '...OrO..',
                '....O...',
                '........'
            ],
            'mage_w': [ // Nova (Snowflake/Star)
                '...C....',
                '.C.C.C..',
                '..CCC...',
                'CCCCCCC.',
                '..CCC...',
                '.C.C.C..',
                '...C....',
                '........'
            ],
            'buff_speed': [ // Winged Boot / Speed Lines
                '........',
                '...CC...',
                '..C..C..',
                '.C....C.',
                'C.YYYY.C',
                '.YYYYYY.',
                '..YYYY..',
                '........'
            ]
        };
    }

    generateIcon(skillName, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Clear previous
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.imageRendering = 'pixelated';
        
        const ctx = canvas.getContext('2d');
        const map = this.icons[skillName];
        if (!map) return;

        const pixelSize = canvas.width / map[0].length;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const char = map[y][x];
                const color = this.palette[char];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }

        container.appendChild(canvas);
    }
    
    // Helper to generate canvas directly (for dynamic elements)
    createIconCanvas(skillName) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.imageRendering = 'pixelated';
        
        const ctx = canvas.getContext('2d');
        const map = this.icons[skillName];
        if (!map) return null;

        const pixelSize = canvas.width / map[0].length;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const char = map[y][x];
                const color = this.palette[char];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            }
        }
        return canvas;
    }
}
