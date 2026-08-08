export class Event{
    constructor(type, data={}){
        this.id = crypto.randomUUID();
        this.type = type;
        this.data = data;
        this.time = Date.now();
    }
}
