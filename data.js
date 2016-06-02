/*
  This file offers all functions pertaining to the IHK presentation.
  It provides example data with approximate realistic distributions and dependencies.
*/



// TODO: function to skew Gauss curve towards one side
// TODO: dates as datatype

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
		var sex = (Math.floor(Math.abs(makeRandom()*2.5-age/30)))?"female":"male"; // skew towards female if older
		var medication = makeMedication(age, sex);
		var diagnoses = makeDiagnoses(age, sex, medication);
		var riskfactors = makeRiskfactors(age, sex, medication);
		var lpa = makeGauss(0,20, function(d){return Math.abs(d);}); // no correlation, always positive
		// TODO: more

		data.push([id, age, sex, medication, diagnoses, riskfactors, lpa]);

		// describe data
		// TODO: define boundaries
		// TODO: make configurable
		var dataStructure = new Array(
			{name: "id", type: "id"},
			{name: "age", type: "int", unit: "years"},
			{name: "sex", type: "enum"},
			{name: "medication", type: "enum"},
			{name: "diagnoses", type:"enum"},
			{name: "riskfactors", type: "enum"},
			{name: "lp(a)", type: "float", unit: "mg/dl"}
		);
	}
	init(data, dataStructure);
}

// adds an element to an array with a likelihood in percent
function addElement(array, element, percent) {
	if (makeRandom()*100<percent) array.push(element);
	return array;
}

function makeMedication(age, sex) {
	var sex = (sex=="female")?1:0;
	var meds = new Array();
	meds = addElement(meds, "Bisoprolol", age/2); // beta blocker for old patients
	meds = addElement(meds, "Simvastatin", 10+20*sex); // statines randomly, more likely if female
	if (meds.indexOf("Simvastatin")<0) meds = addElement(meds, "Atorvastatin", 20); // if no statine yet
	meds = addElement(meds, "Ezetrol", 5); // cholesterine resorption inhibitor
	meds = addElement(meds, "Insulin", 8); // insulin for diabetes
	return meds;
}

function makeDiagnoses(age, sex, medication) {
	var sex = (sex=="female")?1:0;
	var bisoprolol = (medication.indexOf("Bisoprolol")>=0)?1:0;
	var ezetrol = (medication.indexOf("Ezetrol")>=0)?1:0;
	var insulin = (medication.indexOf("Insulin")>=0)?1:0;
	var diagnoses = new Array();
	diagnoses = addElement(diagnoses, "Diabetes", 100*insulin); // only if taking insulin
	diagnoses = addElement(diagnoses, "PAD", 10-10*sex+25*ezetrol+10*insulin); // peripheral artery disease
	diagnoses = addElement(diagnoses, "CAD", 15+8*sex+60*ezetrol-20*bisoprolol); // coronary artery disease
	return diagnoses;
}

function makeRiskfactors(age, sex, medication) {
	var sex = (sex=="female")?1:0;
	var bisoprolol = (medication.indexOf("Bisoprolol")>=0)?1:0;
	var riskfactors = new Array();
	riskfactors = addElement(riskfactors, "Positive family anamnesis", 57+14*sex); // more likely if female
	riskfactors = addElement(riskfactors, "Smoking", 20-10*sex+8*bisoprolol); // more likely to be a smoker if on beta blockers or male
	riskfactors = addElement(riskfactors, "Adipositas", 33); // fixed chance
	return riskfactors;
}

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
