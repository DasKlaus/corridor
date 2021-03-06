/*
  This file offers all functions pertaining to the IHK presentation.
  It provides example data with approximate realistic distributions and dependencies.
*/

/*
   Imports data from a specified csv file
*/
function getCsvData(path) {
	// use d3 to convert csv data into an object
	var parser = d3.dsv(";", "text/plain; charset=ISO-8859-1");
	parser(path, getObjectData); // callback getObjectData for conversion into array and creation of structure
}

/*
   Imports data from an object list
*/
function getObjectData(objectData) {
	var structure = new Array();
	var data = new Array();
	// property names go in data structure, values in data array
	var keys = Object.keys(objectData[0]);
	for(var key in keys) {
		if (objectData[0].hasOwnProperty(keys[key])) {
			// create structure object for this key
			var obj = {name: keys[key], type: "number"}; // type is number by default
			// parse unit from name if set in parantheses
			if (obj.name.endsWith(")") && obj.name.indexOf(" (")>0) {
				obj.unit = obj.name.substr(obj.name.indexOf(" ("));
				obj.name = obj.name.substr(0, obj.name.indexOf(" ("));
			}
			structure.push(obj);
		}
	}
	// loop over data
	for(var row in objectData) {
		var rowData = new Array();
		for(var key in structure) {
			var value = objectData[row][structure[key].name+structure[key].unit];
			if (value == "" || value == undefined) {
				value = null;
			}
			// if value is not empty or a number, then type is enum
			else if (structure[key].type=="number" && parseFloat(value) != value) {
				num = value.replace(",", ".");
				if (parseFloat(num) != num) { 
					structure[key].type="enum";
				} 
				else {
					value = parseFloat(num);
				}
			}
			else if (structure[key].type=="number") {
				value = parseFloat(value);
			} 
			rowData.push(value);
		}
		data.push(rowData);
	}
	getStructure(data, structure);
}

/*
   Get structure via user input
*/
function getStructure(data, structure) {
	if (structure == undefined) {
		// create basic structure
		structure = new Array();
		for (var i=0; i<data[0].length; i++) {
			structure.push({name: "Column "+i, type: "number"});
		}
	}
	corridor.data = data;
	corridor.structure = structure;
	corridor.makeButtons(0);
}

/*
   Creates data of specified length and provides dataStructure
*/
function makeData(size) {
	var size = parseInt(size) || 100;
	var data = new Array();	
	for (var i = 0; i<size; i++) {
		var id = i;
		var age = Math.round(corridor.makeRandom()*20+18+corridor.makeGauss(40,10,function(value){return(value>.25)?value/2:value;})); // skew towards older
		var sex = (Math.floor(Math.abs(corridor.makeRandom()*2.5-age/30)))?"female":"male"; // skew towards female if older
		var medication = makeMedication(age, sex);
		var diagnoses = makeDiagnoses(age, sex, medication);
		var riskfactors = makeRiskfactors(age, sex, medication);
		var lpa = makeLpa(diagnoses, riskfactors); // lipoprotein a
		var ldl = makeLdl(diagnoses, riskfactors); // low density lipoproteins
		var hdl = makeHdl(ldl, age); // high density lipoproteins

		data.push([id, age, sex, medication, diagnoses, riskfactors, lpa, ldl, hdl]);

		// describe data
		var structure = new Array(
			{name: "Id", type: "id"},
			{name: "Age", type: "number", unit: "years"},
			{name: "Sex", type: "enum"},
			{name: "Medication", type: "enum"},
			{name: "Diagnoses", type:"enum"},
			{name: "Riskfactors", type: "enum"},
			{name: "Lp(a)", type: "number", unit: "mg/dl"},
			{name: "LDL", type: "number", unit: "mg/dl"},
			{name: "HDL", type: "number", unit: "mg/dl"}
		);
	}
	corridor.init(data, structure);
}

/*
   adds an element to an array with a likelihood in percent
*/
function addElement(array, element, percent) {
	if (corridor.makeRandom()*100<percent) array.push(element);
	return array;
}

/*
   Returns an array of medications depending on age and sex
*/
function makeMedication(age, sex) {
	var sex = (sex=="female")?1:0;
	var meds = new Array();
	meds = addElement(meds, "Bisoprolol", age/3); // beta blocker for old patients
	meds = addElement(meds, "Simvastatin", 10+20*sex); // more likely if female
	if (meds.indexOf("Simvastatin")<0) meds = addElement(meds, "Atorvastatin", 20); // if no statine yet
	meds = addElement(meds, "Ezetrol", 10); // cholesterine resorption inhibitor
	meds = addElement(meds, "Insulin", 14); // insulin for diabetes
	return meds;
}

/*
   Returns an array of diagnoses depending on age, sex and medication
*/
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

/*
   Returns an array of riskfactors depending on age, sex and medication
*/
function makeRiskfactors(age, sex, medication) {
	var sex = (sex=="female")?1:0;
	var bisoprolol = (medication.indexOf("Bisoprolol")>=0)?1:0;
	var riskfactors = new Array();
	riskfactors = addElement(riskfactors, "Positive family anamnesis", 57+14*sex); // more likely if female
	riskfactors = addElement(riskfactors, "Smoking", 20-10*sex+8*bisoprolol); // more likely to be a smoker if on beta blockers or male
	riskfactors = addElement(riskfactors, "Adipositas", 33); // fixed chance
	return riskfactors;
}

/*
   Returns a numeric Lp(a) value depending on diagnoses and riskfactors
*/
function makeLpa(diagnoses, riskfactors) {
	var cad = (diagnoses.indexOf("CAD")>=0)?1:0;
	var adipositas = (riskfactors.indexOf("Adipositas")>=0)?1:0;
	return Math.abs(corridor.makeGauss(0,20)+40*adipositas-10*cad); // higher lpa if adipose, lower if has coronary artery disease
}

/*
   Returns a numeric LDL value depending on diagnoses and riskfactors
*/
function makeLdl(diagnoses, riskfactors) {
	var pad = (diagnoses.indexOf("PAD")>=0)?1:0;
	var adipositas = (riskfactors.indexOf("Adipositas")>=0)?1:0;
	return Math.abs(corridor.makeGauss(110,20, function(value){return value+2*pad+adipositas;})); // higher ldl if adipose or has peripheral artery disease
}

/*
   Returns a numeric HDL value depending on LDL and age
*/
function makeHdl(ldl, age) {
	return 100-(ldl/2)+age;
}
