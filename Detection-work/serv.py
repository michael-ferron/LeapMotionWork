from flask import Flask, redirect, request
import json
import os

app = Flask(__name__)

@app.route("/")
def Index():
    return redirect("/static/index.html")

@app.route("/list/<path:path>")
def List(path):
    try:
        files = sorted(os.listdir(path))
        result = dict(files=[os.path.join(path, x) for x in files])
    except:
        result = dict(error="Error")

    return json.dumps(result)

@app.route("/save/<experiment>", methods=['POST', "GET"])
def Save(experiment):
    data = request.form.get('data')
    print 'Saving "%s", with data = %s' % (experiment, request.form.keys())
    if data:
        with open(experiment, "w") as f:
            f.write(data)

    return "okay"

app.run(debug=True)
