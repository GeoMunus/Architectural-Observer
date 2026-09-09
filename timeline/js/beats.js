// Beat templates: the grammar of "things that happen in a history".
//
// Each beat declares the cast it needs, what must already be true for it to
// fire, and what it changes about the world. The generator picks beats whose
// preconditions hold, which is what makes a generated timeline read as a chain
// of consequences instead of a shuffled list of incidents.

const beat = (config) => ({
    requires: () => true,
    effects: () => {},
    tags: [],
    weight: 1,
    importance: [2, 3],
    ...config
});

// Cast slot syntax: "kind" or "kind:filter". Filters are resolved in generator.js.
export const BEATS = [
    // ---------------------------------------------------------------- genesis
    beat({
        id: "founding",
        acts: ["genesis"],
        cast: { A: "faction:alive", L: "place:unfounded" },
        weight: 3,
        importance: [3, 4],
        tags: ["founding"],
        title: (c) => `${c.A.name} founds ${c.L.name}`,
        body: (c) =>
            `${c.A.name} establishes a permanent holding at ${c.L.name}, ${c.pick([
                "chosen for water and defensibility rather than beauty",
                "against the advice of everyone who had been there",
                "on ground nobody else had wanted",
                "at the only crossing that stayed open year-round"
            ])}. ${c.consequence()}`,
        effects: (c) => {
            c.setStatus(c.L, "settled");
            c.claim(c.L, c.A);
            c.flag(`founded:${c.L.id}`);
        }
    }),
    beat({
        id: "compact",
        acts: ["genesis", "expansion"],
        cast: { A: "faction:alive", B: "faction:alive" },
        weight: 2,
        tags: ["diplomacy"],
        title: (c) => `The ${c.w("adjective")} Compact between ${c.A.name} and ${c.B.name}`,
        body: (c) =>
            `${c.A.name} and ${c.B.name} agree terms: ${c.pick([
                "shared roads, shared debts, and no questions about the third clause",
                "mutual defence, with the border left deliberately vague",
                "trade at fixed rates for a generation",
                "a division of territory that neither side reads the same way"
            ])}. ${c.pick([
                "It holds longer than anyone expects.",
                "Both parties immediately begin preparing for its failure.",
                "The document survives; the goodwill does not."
            ])}`,
        effects: (c) => c.setRelation(c.A, c.B, "allied")
    }),
    beat({
        id: "firstRecord",
        acts: ["genesis"],
        cast: { A: "faction:alive", P: "person:alive" },
        weight: 2,
        importance: [1, 2],
        tags: ["record"],
        title: (c) => `First surviving mention of ${c.A.name}`,
        body: (c) =>
            `The name appears in ${c.pick([
                "a tax roll",
                "a shipping manifest",
                "a letter of complaint",
                "a list of debts owed",
                "a burial inventory"
            ])} kept by ${c.P.name}, ${c.P.epithet || "a minor official"}. ${c.pick([
                "Everything earlier is inference.",
                "The entry is a single line, and it is already an accusation.",
                "Historians have argued about the spelling ever since."
            ])}`
    }),
    beat({
        id: "commission",
        acts: ["genesis", "expansion"],
        cast: { A: "faction:alive", R: "artifact:uncreated", P: "person:alive" },
        weight: 2,
        importance: [3, 4],
        tags: ["artifact"],
        title: (c) => `${c.A.name} commissions ${c.R.name}`,
        body: (c) =>
            `Built under ${c.P.name} ${c.pick([
                "over eleven years and three budgets",
                "in secret, and finished early",
                "by hands that were not credited",
                "to settle an argument that had already turned violent"
            ])}. ${c.pick([
                "Its stated purpose and its actual purpose differ.",
                "It works. That turns out to be the problem.",
                "Nobody records what it cost to run."
            ])}`,
        effects: (c) => {
            c.setStatus(c.R, "held");
            c.claim(c.R, c.A);
            c.flag(`exists:${c.R.id}`);
        }
    }),
    beat({
        id: "omen",
        acts: ["genesis", "tension", "crisis"],
        cast: { L: "place" },
        weight: 1,
        importance: [1, 2],
        tags: ["omen"],
        title: (c) => `Strange season over ${c.L.name}`,
        body: (c) =>
            `${c.capitalize(c.w("omen"))}. ${c.pick([
                "It is written down, filed, and ignored.",
                "Three separate authorities issue three separate explanations.",
                "In hindsight it is given far more weight than it deserved.",
                "Nobody connects it to anything until much later."
            ])}`
    }),

    // -------------------------------------------------------------- expansion
    beat({
        id: "claimLand",
        acts: ["expansion"],
        cast: { A: "faction:alive", L: "place:unclaimed" },
        weight: 3,
        tags: ["expansion"],
        title: (c) => `${c.A.name} takes ${c.L.name}`,
        body: (c) =>
            `${c.pick([
                "The claim is made on paper first and enforced afterwards",
                "It costs less than expected and is therefore assumed to be a bargain",
                "The previous occupants are described in the record as 'transient'",
                "Three surveyors go out; one comes back with the map that gets used"
            ])}. ${c.consequence()}`,
        effects: (c) => {
            c.claim(c.L, c.A);
            c.setStatus(c.L, "settled");
        }
    }),
    beat({
        id: "rise",
        acts: ["expansion", "tension"],
        cast: { P: "person:alive", A: "faction:alive" },
        weight: 3,
        importance: [3, 4],
        tags: ["power"],
        title: (c) => `${c.P.name} takes control of ${c.A.name}`,
        body: (c) =>
            `${c.pick([
                "The succession is clean enough to survive scrutiny",
                "Two rivals withdraw within a month, one of them permanently",
                "It is not a coup, but the distinction requires explaining",
                "The vote is unanimous, which tells you something about the vote"
            ])}. As ${c.P.epithet || "leader"}, ${c.pFirst(c.P)} ${c.pick([
                "reorganizes everything that can be reorganized",
                "begins paying off debts nobody knew existed",
                "makes one promise publicly and a different one privately",
                "moves the capital, which is more consequential than it sounds"
            ])}.`,
        effects: (c) => {
            c.setLeader(c.A, c.P);
            c.flag(`leads:${c.P.id}:${c.A.id}`);
        }
    }),
    beat({
        id: "discovery",
        acts: ["expansion", "tension"],
        cast: { P: "person:alive", R: "artifact:hidden" },
        weight: 3,
        importance: [3, 5],
        tags: ["artifact", "discovery"],
        title: (c) => `${c.P.name} ${c.w("discovery")} ${c.R.name}`,
        body: (c) =>
            `${c.pick([
                "It has been sitting in plain sight for a long time",
                "The find is accidental and the credit is not",
                "Two other people made the same discovery first and were not believed",
                "Recovering it takes a season; understanding it takes a generation"
            ])}. ${c.pick([
                "Word travels faster than the object does.",
                "Its owners are notified last.",
                "The first people to use it do not survive the experience.",
                "It changes what everyone assumes is possible."
            ])}`,
        effects: (c) => {
            c.setStatus(c.R, "held");
            c.flag(`found:${c.R.id}`);
            if (c.P.affiliation) c.claimById(c.R, c.P.affiliation);
        }
    }),
    beat({
        id: "innovation",
        acts: ["expansion"],
        cast: { A: "faction:alive", P: "person:alive" },
        weight: 2,
        importance: [2, 4],
        tags: ["innovation"],
        title: (c) => `${c.P.name} ${c.w("discovery")} a method that changes ${c.A.name}`,
        body: (c) =>
            `${c.pick([
                "The technique is unglamorous and enormously profitable",
                "It halves a cost that everyone had assumed was fixed",
                "It is published, then regretted",
                "Adoption takes nine years and then happens all at once"
            ])}. ${c.consequence()}`,
        effects: (c) => c.flag(`innovation:${c.A.id}`)
    }),
    beat({
        id: "route",
        acts: ["expansion"],
        cast: { A: "faction:alive", L: "place:settled" },
        weight: 2,
        tags: ["trade"],
        title: (c) => `The route to ${c.L.name} opens`,
        body: (c) =>
            `${c.A.name} ${c.pick([
                "secures the crossing and immediately begins taxing it",
                "underwrites the first regular traffic, at a loss, deliberately",
                "wins the contract by outlasting two better-funded rivals"
            ])}. ${c.pick([
                "Within a decade nobody remembers the route not existing.",
                "The tolls fund everything that comes after.",
                "It also becomes the fastest way for bad news to travel."
            ])}`,
        effects: (c) => c.flag(`route:${c.L.id}`)
    }),

    // ---------------------------------------------------------------- tension
    beat({
        id: "rivalry",
        acts: ["tension"],
        cast: { A: "faction:alive", B: "faction:alive" },
        weight: 4,
        importance: [2, 4],
        tags: ["rivalry"],
        title: (c) => `${c.A.name} and ${c.B.name} fall out`,
        body: (c) =>
            `${c.pick([
                "The stated cause is a boundary; the real cause is a shortfall",
                "An insult is delivered in a setting where it cannot be walked back",
                "One side audits the other and publishes the findings",
                "A shared obligation is quietly not honoured"
            ])}. ${c.pick([
                "Envoys are recalled without ceremony.",
                "Both sides begin arming, while insisting they are not.",
                "The dispute is referred to arbitration and stays there for years."
            ])}`,
        effects: (c) => c.setRelation(c.A, c.B, "hostile")
    }),
    beat({
        id: "betrayal",
        acts: ["tension", "crisis"],
        cast: { P: "person:alive", A: "faction:alive", B: "faction:alive" },
        weight: 2,
        importance: [3, 4],
        tags: ["betrayal"],
        title: (c) => `${c.P.name} changes sides`,
        body: (c) =>
            `${c.pFirst(c.P)} leaves ${c.A.name} for ${c.B.name}, taking ${c.pick([
                "the maps",
                "the ledgers",
                "four hundred people and their loyalty",
                "the only working copy",
                "nothing but the knowledge, which is worse"
            ])}. ${c.pick([
                "The reasons given at the time are not the reasons.",
                "It is treated as treason by one side and recruitment by the other.",
                "Neither side ever fully trusts them again."
            ])}`,
        effects: (c) => {
            c.P.affiliation = c.B.id;
            c.setRelation(c.A, c.B, "hostile");
            c.flag(`betrayal:${c.P.id}`);
        }
    }),
    beat({
        id: "schism",
        acts: ["tension", "crisis"],
        cast: { A: "faction:alive" },
        weight: 2,
        importance: [3, 5],
        tags: ["schism"],
        creates: "faction",
        title: (c) => `${c.A.name} splits`,
        body: (c) =>
            `A faction within ${c.A.name} breaks away as ${c.created.name}, ${c.pick([
                "over a question of doctrine that everyone privately admits is about money",
                "after the succession is settled the wrong way",
                "taking the southern holdings and most of the fleet",
                "citing eleven grievances, of which two are real"
            ])}. ${c.pick([
                "The parent body calls it a rebellion and refuses the name.",
                "Both halves claim the original charter.",
                "The split is permanent, though it takes decades to be admitted."
            ])}`,
        effects: (c) => {
            c.setRelation(c.A, c.created, "hostile");
            c.flag(`schism:${c.A.id}`);
        }
    }),
    beat({
        id: "vanish",
        acts: ["tension", "crisis"],
        cast: { R: "artifact:held" },
        weight: 2,
        importance: [3, 4],
        tags: ["artifact", "mystery"],
        title: (c) => `${c.R.name} goes missing`,
        body: (c) =>
            `${c.pick([
                "The loss is not reported for eight months",
                "Three people are blamed and none of them did it",
                "The inventory says it is still there; it is not",
                "It leaves with someone who had every right to be in the room"
            ])}. ${c.pick([
                "Searches are conducted, then quietly discontinued.",
                "A convincing forgery takes its place in the record.",
                "It resurfaces later, in worse hands."
            ])}`,
        effects: (c) => {
            c.setStatus(c.R, "hidden");
            c.flag(`lost:${c.R.id}`);
        }
    }),
    beat({
        id: "warning",
        acts: ["tension"],
        cast: { P: "person:alive", F: "force" },
        weight: 2,
        importance: [2, 3],
        tags: ["warning"],
        title: (c) => `${c.P.name} warns about ${c.F.name}`,
        body: (c) =>
            `The argument is ${c.pick([
                "correct in outline and wrong in every detail, which discredits it",
                "circulated widely and acted on by nobody",
                "suppressed, then leaked, then suppressed again",
                "dismissed as self-interested, because it partly is"
            ])}. ${c.pick([
                "It will be quoted at length afterwards.",
                "The warning is filed under the wrong heading and lost for years.",
                "Two people take it seriously. Both survive what follows."
            ])}`,
        effects: (c) => {
            c.setStatus(c.F, "rising");
            c.flag(`warned:${c.F.id}`);
        }
    }),
    beat({
        id: "incident",
        acts: ["tension"],
        cast: { A: "faction:alive", B: "faction:hostileTo:A", L: "place" },
        weight: 3,
        importance: [2, 4],
        tags: ["incident"],
        title: (c) => `The incident at ${c.L.name}`,
        body: (c) =>
            `A ${c.pick(["patrol", "customs inspection", "supply convoy", "survey party"])} from ${
                c.A.name
            } meets one from ${c.B.name}. ${c.pick([
                "Nineteen people die in under an hour.",
                "Nobody is killed, which makes it harder to resolve.",
                "Both sides file reports that cannot both be true.",
                "The shooting stops, but the account of who started it never settles."
            ])} ${c.consequence()}`,
        effects: (c) => c.flag(`incident:${c.A.id}:${c.B.id}`)
    }),

    // ----------------------------------------------------------------- crisis
    beat({
        id: "warDeclared",
        acts: ["crisis"],
        cast: { A: "faction:alive", B: "faction:hostileTo:A" },
        weight: 5,
        importance: [4, 5],
        tags: ["war"],
        title: (c) => `${c.A.name} declares ${c.w("conflict")} on ${c.B.name}`,
        body: (c) =>
            `${c.pick([
                "The declaration is a formality; the fighting started months earlier",
                "It is framed as enforcement of an existing agreement",
                "Both sides expect it to last one season"
            ])}. ${c.pick([
                "It lasts considerably longer than one season.",
                "Neutral parties choose sides within weeks.",
                "The first year is the only year anyone will later defend."
            ])}`,
        effects: (c) => {
            c.setRelation(c.A, c.B, "war");
            c.flag(`war:${c.A.id}:${c.B.id}`);
        }
    }),
    beat({
        id: "siege",
        acts: ["crisis", "cataclysm"],
        cast: { A: "faction:atWar", L: "place:settled" },
        weight: 3,
        importance: [3, 5],
        tags: ["war", "siege"],
        title: (c) => `The siege of ${c.L.name}`,
        body: (c) =>
            `${c.A.name} invests the place for ${c.pick([
                "eleven months",
                "two winters",
                "forty days",
                "longer than the war it belongs to"
            ])}. ${c.pick([
                "The walls hold. The wells do not.",
                "It falls to negotiation rather than assault, which nobody finds satisfying.",
                "Relief arrives four days after the surrender.",
                "What is left standing is not worth the taking."
            ])}`,
        effects: (c) => {
            c.setStatus(c.L, "besieged");
            c.flag(`siege:${c.L.id}`);
        }
    }),
    beat({
        id: "assassination",
        acts: ["crisis"],
        cast: { P: "person:alive" },
        weight: 3,
        importance: [4, 5],
        tags: ["death"],
        title: (c) => `${c.P.name} is killed`,
        body: (c) =>
            `${c.pick([
                "In a corridor, by someone with legitimate access",
                "Publicly, and the crowd does not intervene",
                "Quietly enough that the death is announced as illness",
                "During a negotiation both sides had described as promising"
            ])}. ${c.pick([
                "Four separate parties claim responsibility; at most one is telling the truth.",
                "The successor is in place within a day, which raises questions.",
                "It ends a policy that had no other opponents.",
                "The killing is avenged twice, on the wrong people."
            ])}`,
        effects: (c) => {
            c.setStatus(c.P, "dead");
            c.flag(`dead:${c.P.id}`);
        }
    }),
    beat({
        id: "forceAwakens",
        acts: ["crisis", "cataclysm"],
        cast: { F: "force", L: "place" },
        weight: 3,
        importance: [4, 5],
        tags: ["force", "catastrophe"],
        title: (c) => `${c.capitalize(c.F.name)} reaches ${c.L.name}`,
        body: (c) =>
            `${c.pick([
                "It arrives faster than the models allowed for",
                "The early cases are misdiagnosed as something ordinary",
                "Containment is attempted and is worse than the thing contained",
                "Nobody agrees on what it is, only on where it has been"
            ])}. ${c.pick([
                "Movement in and out is stopped, far too late.",
                "The response consumes every reserve set aside for anything else.",
                "Records from this period thin out sharply."
            ])}`,
        effects: (c) => {
            c.setStatus(c.F, "active");
            c.setStatus(c.L, "stricken");
            c.flag(`unleashed:${c.F.id}`);
        }
    }),
    beat({
        id: "alliance",
        acts: ["crisis"],
        cast: { A: "faction:alive", B: "faction:alive" },
        weight: 2,
        importance: [3, 4],
        tags: ["diplomacy"],
        title: (c) => `${c.A.name} and ${c.B.name} make common cause`,
        body: (c) =>
            `Old enemies, ${c.pick([
                "aligned by a threat that outranks their grievance",
                "pushed together by everyone else refusing to help",
                "united on paper and barely coordinated in practice"
            ])}. ${c.pick([
                "The alliance wins. It does not survive winning.",
                "It is the most effective thing either of them ever does.",
                "Each keeps a private accounting of what the other owes."
            ])}`,
        effects: (c) => c.setRelation(c.A, c.B, "allied")
    }),
    beat({
        id: "contest",
        acts: ["crisis", "cataclysm"],
        cast: { R: "artifact:known", A: "faction:alive", B: "faction:alive" },
        weight: 2,
        importance: [3, 5],
        tags: ["artifact", "war"],
        title: (c) => `${c.A.name} and ${c.B.name} fight over ${c.R.name}`,
        body: (c) =>
            `${c.pick([
                "Both claims are legitimate under different readings of the same document",
                "It is worth more than the campaign fought for it, but only just",
                "Neither side is willing to let the other have it, which is the whole argument"
            ])}. ${c.pick([
                "It changes hands three times in two years.",
                "It is damaged in the taking and never fully works again.",
                "The winner discovers it was never the important part."
            ])}`,
        effects: (c) => {
            c.setRelation(c.A, c.B, "war");
            c.claim(c.R, c.A);
        }
    }),

    // -------------------------------------------------------------- cataclysm
    beat({
        id: "placeFalls",
        acts: ["cataclysm"],
        cast: { L: "place:settled", A: "faction:alive" },
        weight: 4,
        importance: [4, 5],
        tags: ["catastrophe"],
        title: (c) => `${c.L.name} ${c.w("ruin")}`,
        body: (c) =>
            `${c.pick([
                "The evacuation is orderly for six hours and then is not",
                "It is not destroyed so much as emptied",
                "What burns is mostly the archive, which is the real loss",
                "The population leaves over three years; the last families are never counted"
            ])}. ${c.A.name} ${c.pick([
                "is blamed, fairly.",
                "is blamed, unfairly, and never recovers the reputation.",
                "arrives to help and is remembered for arriving late.",
                "records the event in two lines."
            ])}`,
        effects: (c) => {
            c.setStatus(c.L, "ruined");
            c.flag(`ruined:${c.L.id}`);
        }
    }),
    beat({
        id: "factionFalls",
        acts: ["cataclysm"],
        cast: { A: "faction:alive" },
        weight: 3,
        importance: [4, 5],
        tags: ["collapse"],
        title: (c) => `${c.A.name} ${c.w("collapse")}`,
        body: (c) =>
            `${c.pick([
                "The end is administrative before it is physical: the payments stop, then everything else does",
                "Its territory is absorbed by three neighbours within a decade",
                "It survives on paper for another generation, which fools nobody",
                "The final assembly is attended by fewer than a hundred people"
            ])}. ${c.pick([
                "Its archives are divided as spoils.",
                "The name is kept as a brand by people who had nothing to do with it.",
                "Debts outlive it by a century."
            ])}`,
        effects: (c) => {
            c.setStatus(c.A, "fallen");
            c.flag(`fallen:${c.A.id}`);
        }
    }),
    beat({
        id: "lastStand",
        acts: ["cataclysm"],
        cast: { P: "person:alive", L: "place" },
        weight: 3,
        importance: [4, 5],
        tags: ["death", "war"],
        title: (c) => `${c.P.name} holds ${c.L.name}`,
        body: (c) =>
            `${c.pFirst(c.P)} ${c.pick([
                "refuses the withdrawal order and buys eleven days",
                "gets four thousand people out and does not leave with them",
                "holds a position of no strategic value, for reasons that are never explained",
                "surrenders, having first destroyed everything worth surrendering"
            ])}. ${c.pick([
                "The account that survives was written by the other side.",
                "It is the last thing anyone records about them.",
                "The gesture is remembered better than the war it belonged to."
            ])}`,
        effects: (c) => {
            c.setStatus(c.P, "dead");
            c.flag(`dead:${c.P.id}`);
        }
    }),
    beat({
        id: "artifactSpent",
        acts: ["cataclysm"],
        cast: { R: "artifact:known" },
        weight: 2,
        importance: [4, 5],
        tags: ["artifact", "catastrophe"],
        title: (c) => `${c.R.name} is used, once`,
        body: (c) =>
            `${c.pick([
                "It does exactly what it was built to do",
                "The effect exceeds every estimate, including the pessimistic ones",
                "It works, and is unusable afterwards",
                "Whatever it was for, this was not it"
            ])}. ${c.pick([
                "The decision to use it is made by four people in under an hour.",
                "Nobody who authorized it is willing to be named.",
                "Its use ends the war and starts the argument."
            ])}`,
        effects: (c) => {
            c.setStatus(c.R, "spent");
            c.flag(`spent:${c.R.id}`);
        }
    }),

    // -------------------------------------------------------------- aftermath
    beat({
        id: "treaty",
        acts: ["aftermath"],
        cast: { A: "faction:atWar", B: "faction:atWarWith:A" },
        weight: 5,
        importance: [3, 5],
        tags: ["diplomacy", "peace"],
        title: (c) => `${c.A.name} and ${c.B.name} come to terms`,
        body: (c) =>
            `Signed at ${c.pick(["a border post", "a neutral port", "the ruins of the thing they fought over", "a house belonging to neither"])}, ${c.pick([
                "after both sides run out of anything to fight with",
                "on terms nobody defends publicly",
                "with the difficult clause deferred by twenty years"
            ])}. ${c.pick([
                "The deferred clause causes the next war.",
                "It holds. That surprises the people who wrote it.",
                "Both delegations describe it as a defeat, which is usually a good sign."
            ])}`,
        effects: (c) => {
            c.setRelation(c.A, c.B, "wary");
            c.flag(`peace:${c.A.id}:${c.B.id}`);
        }
    }),
    beat({
        id: "rebuild",
        acts: ["aftermath"],
        cast: { L: "place:ruined", A: "faction:alive" },
        weight: 3,
        tags: ["rebuild"],
        title: (c) => `${c.L.name} is resettled`,
        body: (c) =>
            `${c.A.name} ${c.pick([
                "funds the rebuilding and names it after itself",
                "permits resettlement without funding it",
                "rebuilds the walls first and the housing eventually"
            ])}. ${c.pick([
                "The new town sits beside the old one rather than on it.",
                "Half the returning families are not the families that left.",
                "The street plan is straighter, which everyone dislikes."
            ])}`,
        effects: (c) => {
            c.setStatus(c.L, "settled");
            c.claim(c.L, c.A);
        }
    }),
    beat({
        id: "tribunal",
        acts: ["aftermath"],
        cast: { A: "faction:alive", P: "person:alive" },
        weight: 3,
        importance: [3, 4],
        tags: ["reckoning"],
        title: (c) => `The inquiry into ${c.A.name}`,
        body: (c) =>
            `${c.P.name} chairs proceedings that ${c.pick([
                "last two years and convict three clerks",
                "establish the facts and assign none of the blame",
                "are abandoned when the funding is withdrawn",
                "produce a report that is sealed for fifty years"
            ])}. ${c.pick([
                "The sealed volume is the only one anyone wants.",
                "Its findings become the standard account, correct or not.",
                "Everyone senior enough to answer for it is already dead."
            ])}`,
        effects: (c) => c.flag(`inquiry:${c.A.id}`)
    }),
    beat({
        id: "exodus",
        acts: ["aftermath", "cataclysm"],
        cast: { A: "faction:alive" },
        weight: 2,
        importance: [3, 4],
        tags: ["migration"],
        creates: "place",
        title: (c) => `The move to ${c.created.name}`,
        body: (c) =>
            `People leaving ${c.A.name}'s territory settle ${c.created.name}, ${c.pick([
                "which had been considered uninhabitable and was merely unpleasant",
                "far enough out to be nobody's responsibility",
                "on the strength of a single favourable survey"
            ])}. ${c.pick([
                "Within thirty years it is the larger settlement.",
                "They take the grievance with them intact.",
                "The first two winters kill a fifth of them."
            ])}`,
        effects: (c) => {
            c.setStatus(c.created, "settled");
            c.claim(c.created, c.A);
        }
    }),
    beat({
        id: "recovered",
        acts: ["aftermath", "legacy"],
        cast: { R: "artifact:hidden", P: "person:alive" },
        weight: 2,
        importance: [3, 4],
        tags: ["artifact", "discovery"],
        title: (c) => `${c.R.name} resurfaces`,
        body: (c) =>
            `Found by ${c.P.name} ${c.pick([
                "in a lot of unrelated salvage",
                "exactly where the earliest account said it would be",
                "in the possession of someone who did not know what they had",
                "during work on something else entirely"
            ])}. ${c.pick([
                "Authentication takes longer than the search did.",
                "Three parties immediately claim ownership.",
                "It is quietly returned to storage, and this time the location is written down."
            ])}`,
        effects: (c) => {
            c.setStatus(c.R, "held");
            c.flag(`found:${c.R.id}`);
        }
    }),

    // ----------------------------------------------------------------- legacy
    beat({
        id: "myth",
        acts: ["legacy"],
        cast: { P: "person", L: "place" },
        weight: 3,
        importance: [2, 3],
        tags: ["memory"],
        title: (c) => `${c.P.name} becomes a story`,
        body: (c) =>
            `By now the version told at ${c.L.name} ${c.pick([
                "has them present at three events they missed",
                "has removed everyone else from the room",
                "is shorter, better, and wrong",
                "is used to settle arguments about property"
            ])}. ${c.pick([
                "The documentary record is thinner and much less popular.",
                "Two towns claim the burial site.",
                "Correcting it is considered bad manners."
            ])}`,
        effects: (c) => c.flag(`myth:${c.P.id}`)
    }),
    beat({
        id: "successor",
        acts: ["legacy"],
        cast: { A: "faction:fallen" },
        weight: 3,
        importance: [3, 4],
        creates: "faction",
        tags: ["founding"],
        title: (c) => `${c.created.name} claims the inheritance of ${c.A.name}`,
        body: (c) =>
            `${c.pick([
                "The genealogy is constructed backwards from the conclusion",
                "The claim rests on holding the archive rather than the bloodline",
                "Two other bodies make the same claim and lose the argument"
            ])}. ${c.pick([
                "It is accepted because contesting it serves nobody.",
                "The old symbols are revived with the awkward parts removed.",
                "Within a generation the descent is treated as fact."
            ])}`,
        effects: (c) => c.flag(`successor:${c.A.id}`)
    }),
    beat({
        id: "sealed",
        acts: ["legacy"],
        cast: { A: "faction:alive", R: "artifact:known" },
        weight: 2,
        importance: [2, 4],
        tags: ["record"],
        title: (c) => `${c.A.name} seals the record on ${c.R.name}`,
        body: (c) =>
            `${c.pick([
                "Access is restricted for reasons the restriction order does not give",
                "The catalogue entry remains; the object does not",
                "It is moved somewhere secure and then, administratively, forgotten"
            ])}. ${c.pick([
                "Copies exist. Everyone involved knows this.",
                "The seal outlasts the institution that applied it.",
                "It is opened once, by accident, and closed again immediately."
            ])}`,
        effects: (c) => c.setStatus(c.R, "sealed")
    }),
    beat({
        id: "recurrence",
        acts: ["legacy"],
        cast: { F: "force", L: "place:settled" },
        weight: 2,
        importance: [3, 5],
        tags: ["force", "omen"],
        title: (c) => `The first sign of ${c.F.name} returning`,
        body: (c) =>
            `At ${c.L.name}, ${c.pick([
                "the same readings appear that preceded it last time",
                "an old warning is rediscovered and immediately disputed",
                "three unconnected people report the same thing in the same month"
            ])}. ${c.pick([
                "The record ends here, which is not the same as nothing happening.",
                "The response is faster this time, and still not fast enough.",
                "Nobody alive remembers the first occurrence directly."
            ])}`,
        effects: (c) => c.setStatus(c.F, "rising")
    }),
    beat({
        id: "quietEnd",
        acts: ["legacy"],
        cast: { A: "faction:alive", P: "person:alive" },
        weight: 2,
        importance: [1, 3],
        tags: ["record"],
        title: (c) => `${c.P.name} closes the ledger`,
        body: (c) =>
            `The last entry made in ${c.A.name}'s own hand ${c.pick([
                "concerns a shipment of grain",
                "is a list of names with no explanation",
                "is unfinished mid-sentence",
                "records the weather and nothing else"
            ])}. ${c.pick([
                "Everything after this is reconstruction.",
                "The next volume was begun, and has not been found.",
                "It is the most quoted document of the period, mostly out of context."
            ])}`
    })
];

export const BEATS_BY_ACT = BEATS.reduce((acc, b) => {
    b.acts.forEach((act) => {
        (acc[act] = acc[act] || []).push(b);
    });
    return acc;
}, {});
