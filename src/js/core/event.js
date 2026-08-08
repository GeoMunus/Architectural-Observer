import { uuid } from "./id.js";

export class Event{
    constructor(type, data={}){
        this.id = uuid();
        this.type = type;
        this.data = data;
        this.time = Date.now();
    }
}
