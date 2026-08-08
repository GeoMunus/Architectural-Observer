export class Thing{
    constructor(type, properties={}){
        this.id = crypto.randomUUID();
        this.type = type;
        this.properties = properties;
    }
}
