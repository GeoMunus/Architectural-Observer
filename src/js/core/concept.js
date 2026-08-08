import { uuid } from "./id.js";

export class Concept{
    constructor(name){
        this.id = uuid();
        this.name = name;
        this.examples = [];
        this.confidence = 0;
    }
}
