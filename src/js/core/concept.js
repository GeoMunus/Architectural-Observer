export class Concept{
    constructor(name){
        this.id = crypto.randomUUID();
        this.name = name;
        this.examples = [];
        this.confidence = 0;
    }
}
