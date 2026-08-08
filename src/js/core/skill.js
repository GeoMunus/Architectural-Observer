import { uuid } from "./id.js";

export class Skill{
    constructor(name){
        this.id = uuid();
        this.name = name;
        this.steps = [];
        this.successRate = 0;
    }
}
