/*
  This file offers all functions pertaining to the IHK presentation.
  It provides example data with approximate realistic distributions and dependencies.
*/

// seeded random numbers for consistent data generation
seed = 0;
function makeRandom() {
	var x = Math.sin(seed++)*10000;
	return x-Math.floor(x); // throw away first four digits for randomness
}

// this is an adaptation of the Java implementation of nextGaussian
// Gaussian numbers come in pairs, so one has to be kept in storage
storedGauss = {
	used: true,
	number: 0
}
function makeGauss(mean, deviation, process) {
	mean = mean || 0; // optional mean
	deviation = deviation || 1 // optional standard deviation
	process = (process === undefined)?function(value){return value;}:process; // optional further processing
	if (!storedGauss.used) {
		storedGauss.used = true;
		return process(storedGauss.number) * deviation + mean;
	}
	var v1, v2, s;
	do {
		v1 = 2 * makeRandom()-1;
		v2 = 2 * makeRandom()-1;
		s = v1 * v1 + v2* v2;
	} while (s >= 1 || s == 0);
	var multiplier = Math.sqrt(-2 * Math.log(s)/s);
	storedGauss.number = v2 * multiplier; // store raw number in case parameters differ on next call
	done = true;
	return process(v1 * multiplier) * deviation + mean;
}

// TODO: function to skew Gauss curve towards one side

// make data
// similar to Kapro data because familarity
// id (int)
// name (string) (?)
// age (int)
// sex (enum)
// medication (array)
// diagnoses (array)
// risk factors (array)
// some number array - reduction by apheresis treatment?
// lp(a), LDL, HDL, Trig (float)


// create data
function makeData(size) {
	var size = parseInt(size) || 100;
	var data = new Array();	
	for (var i = 0; i<size; i++) {
		var id = i;
		var age = Math.round(makeRandom()*20+18+makeGauss(40,10,function(value){return(value>.25)?value/2:value;})); // skew towards older
		var sex = (Math.floor(Math.abs(makeRandom()*2.5-age/50)))?"male":"female"; // skew towards female if older
		var medication = makeMedication(Math.floor(makeRandom()*10));
		var lpa = makeGauss(0,20, function(d){return Math.abs(d);}); // no correlation, always positive
		// TODO: more

		data.push([id, age, sex, medication, lpa]);

		// describe data
		// TODO: define boundaries
		// TODO: make configurable
		var dataStructure = new Array(
			{name: "id", type: "id"},
			{name: "age", type: "int", unit: "years"},
			{name: "sex", type: "enum"},
			{name: "medication", type: "enum"},
			{name: "lp(a)", type: "float", unit: "mg/dl"}
		);
	}
	init(data, dataStructure);
}

function makeMedication(rand, others) { // TODO: dependencies!
	if (others == undefined) others = new Array(); // if others are not set, create an empty array
	var meds = others;
	if (rand>7) return meds; // patient has no further medication
	if (rand==7) meds.push("Ezetimib");
	if (rand==6 || rand==5) meds.push("Simvastatin");
	if (rand==4 || rand==3) meds.push("Atorvastatin");
	if (rand==2) meds.push("Aspirin");
	if (rand==1) meds.push("Buscopan");
	if (rand==0) meds.push("Paracetamol");
	if (rand<4) return makeMedication(Math.floor(makeRandom()*8), meds); // add new medication
	return meds;
}
