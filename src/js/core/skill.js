export class Skill{
    constructor(name){
        this.id = crypto.randomUUID();
        this.name = name;
        this.steps = [];
        this.successRate = 0;
    }
}
