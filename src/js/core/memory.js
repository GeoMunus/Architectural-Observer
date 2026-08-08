import { uuid } from "./id.js";

export class Memory{
    constructor(){
        this.id = uuid();
        this.objects = [];
        this.events = [];
        this.importance = 0;
        this.confidence = 0;
    }
}
