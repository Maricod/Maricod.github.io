'use strict';

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error("Можно прибавлять к вектору только вектор типа Vector");
        }
        return new Vector(this.x + vector.x, this.y + vector.y);

    }
    times(factor) {
        return new Vector(this.x * factor, this.y * factor);
    }
}


class Actor {
    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
        if (!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)) {
            throw new Error("Не объект типа Vector");
        }
        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }
    act() {}

    get type() {
        return 'actor';
    }

    get left() {
        return this.pos.x;
    }
    get top() {
        return this.pos.y;
    }
    get right() {
        return this.pos.x + this.size.x;
    }
    get bottom() {
        return this.pos.y + this.size.y;
    }

    isIntersect(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error("Неверно задан actor");
        }

        if (actor === this) {
            return false;
        }

        return actor.left < this.right && actor.right > this.left && actor.top < this.bottom && actor.bottom > this.top;
    }
}

class Level {
    constructor(grid = [], actors = []) {
        this.grid = grid.slice();
        this.actors = actors.slice();
        this.height = this.grid.length;
        this.width = grid.reduce((accumulator, value) => value.length > accumulator ? value.length : accumulator, 0);
        this.status = null;
        this.finishDelay = 1;
        this.player = this.actors.find(value => value.type === 'player');
    }
    isFinished() {
        return this.status !== null && this.finishDelay < 0;
    }

    actorAt(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error("Неверно передан actor");
        }
        return this.actors.find(value => value.isIntersect(actor));

    }
    obstacleAt(pos, size) {
        if (!(pos instanceof Vector) || !(size instanceof Vector)) {
            throw new Error("не передан объект типа Vector");
        }
        const xStart = Math.floor(pos.x);
        const xEnd = Math.ceil(pos.x + size.x);
        const yStart = Math.floor(pos.y);
        const yEnd = Math.ceil(pos.y + size.y);

        if (xStart < 0 || xEnd > this.width || yStart < 0) {
            return 'wall';
        }

        if (yEnd > this.height) {
            return 'lava';
        }

        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                const obstacle = this.grid[y][x];
                if (obstacle) {
                    return obstacle;
                }
            }
        }
    }

    removeActor(actor) {
        this.actors = this.actors.filter(el => el !== actor);
    }

    noMoreActors(type) {
        return !this.actors.some(actor => actor.type === type);
    }
    playerTouched(type, actor) {
        if (this.status !== null) {
            return;
        }
        if (type === 'lava' || type === 'fireball') {
            this.status = 'lost';
        } else if (type === 'coin') {
            this.removeActor(actor);
            if (this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}


class LevelParser {
    constructor(dictionary) {
        this.dictionary = Object.assign({}, dictionary);
    }
    actorFromSymbol(symbol) {
        return this.dictionary[symbol];
    }
    obstacleFromSymbol(symbol) {
        if (symbol === 'x') {
            return 'wall';
        }
        if (symbol === '!') {
            return 'lava';
        }
    }
    createGrid(plan) {
        return plan.map(lowerString => lowerString.split('').map(symbol => this.obstacleFromSymbol(symbol)));
    }

    createActors(plan) {
        const actors = [];
        plan.map(el => el.split('')).forEach((row, y) => {
            row.forEach((cell, x) => {
                const constructor = this.actorFromSymbol(cell);
                if (constructor && typeof constructor === 'function') {
                    const actor = new constructor(new Vector(x, y));
                    if (actor instanceof Actor) {
                        actors.push(actor);
                    }
                }
            });
        });
        return actors;
    }
    parse(plan) {
        return new Level(this.createGrid(plan), this.createActors(plan));
    }
}

class Fireball extends Actor {
    constructor(pos = new Vector(0, 0), speed = new Vector(0, 0)) {
        super(pos, new Vector(1, 1), speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        const newPosition = this.getNextPosition(time);

        if (level.obstacleAt(newPosition, this.size)) {

            this.handleObstacle();

        } else {

            this.pos = newPosition;
        }
    }
}

class HorizontalFireball extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(2, 0));
    }

}

class VerticalFireball extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(0, 2));
    }

}

class FireRain extends Fireball {
    constructor(pos = new Vector(0, 0)) {
        super(pos, new Vector(0, 3));
        this.startPos = this.pos;
    }

    handleObstacle() {
        this.pos = this.startPos;
    }
}

class Coin extends Actor {
    constructor(pos = new Vector(0, 0)) {
        super(pos.plus(new Vector(0.2, 0.1)), new Vector(0.6, 0.6));
        this.springSpeed = 8;
        this.springDist = 0.07;
        this.spring = Math.random() * (Math.PI * 2);
        this.startPos = this.pos;
    }

    get type() {
        return 'coin';
    }

    updateSpring(time = 1) {
        this.spring = this.spring + this.springSpeed * time;
    }

    getSpringVector() {
        return new Vector(0, Math.sin(this.spring) * this.springDist);
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);
        return this.startPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos = new Vector(0, 0)) {
        super(pos.plus(new Vector(0, -0.5)), new Vector(0.8, 1.5));
    }

    get type() {
        return 'player';
    }
}


const schemas = [
    [
        '         ',
        '   h     ',
        '         ',
        '       o ',
        '@     xxx',
        '         ',
        'xxx      ',
        '         '
    ],
    [
        '   v     ',
        '         ',
        '         ',
        '@       o',
        '        x',
        '    x    ',
        'x        ',
        '         '
    ],
    [
        '            ',
        '      v     ',
        '           o',
        '@       o  x',
        '    o   x   ',
        '    x       ',
        'x           ',
        '            '
    ],
    [
        ' v           ',
        '             ',
        '             ',
        '@   h    o   ',
        '        xx   ',
        '    xx       ',
        'xx         o ',
        '           xx'
    ]
];

const actorDict = {
    '@': Player,
    'v': VerticalFireball,
    'o': Coin,
    'h': HorizontalFireball,
    'f': FireRain
};

const parser = new LevelParser(actorDict);
runGame(schemas, parser, DOMDisplay)
    .then(() => alert('Вы выиграли приз!'));
