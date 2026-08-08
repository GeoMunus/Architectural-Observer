import { uuid } from "./id.js";

export class Thing{
    constructor(type, properties={}){
        this.id = uuid();
        this.type = type;
        this.properties = properties;
    }
}
