export class Memory{
    constructor(){
        this.id = crypto.randomUUID();
        this.objects = [];
        this.events = [];
        this.importance = 0;
        this.confidence = 0;
    }
}
