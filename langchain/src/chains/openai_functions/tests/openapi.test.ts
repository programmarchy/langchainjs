import { test, expect } from "@jest/globals";

import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { JsonSchema7StringType } from "zod-to-json-schema/src/parsers/string.js";
import { JsonSchema7NumberType } from "zod-to-json-schema/src/parsers/number.js";
import { JsonSchema7ObjectType } from "zod-to-json-schema/src/parsers/object.js";
import { JsonSchema7ArrayType } from "zod-to-json-schema/src/parsers/array.js";
import { OpenAPISpec } from "../../../util/openapi.js";
import { convertOpenAPISchemaToJSONSchema } from "../openapi.js";

describe("OpenAPI spec to OpenAI functions", () => {
  test("converts OpenAPI params to JSON Schema", () => {
    const spec = new OpenAPISpec({
      "openapi": "3.1.0",
      "info": {
        "title": "A fake spec for testing",
        "version": "0.0.1",
      },
      "paths": {
        "/widgets": {
          "post": {
            "operationId": "createWidget",
            "description": "Create a widget",
            "parameters": [
              {
                "name": "stringParam",
                "in": "query",
                "schema": {
                  "type": "string"
                }
              },
              {
                "name": "objectParam",
                "in": "query",
                "schema": {
                  "type": "object",
                  "properties": {
                    "foo": {
                      "type": "string"
                    },
                    "bar": {
                      "type": "number"
                    }
                  }
                }
              },
              {
                "name": "stringArrayParam",
                "in": "query",
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  }
                }
              },
              {
                "name": "nestedObjectInArrayParam",
                "in": "query",
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "baz": {
                        "type": "number"
                      }
                    }
                  }
                }
              },
              {
                "name": "nestedArrayInObjectParam",
                "in": "query",
                "schema": {
                  "type": "object",
                  "properties": {
                    "qux": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  }
                }
              },
              {
                "name": "inceptionParam",
                "in": "query",
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "nestedArray": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "nestedObject": {
                              "type": "object",
                              "properties": {
                                "inception": {
                                  "type": "number"
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            ],
            "responses": {
              "200": {
                "description": "OK",
                "content": {
                  "application/json": {
                    "schema": {
                      "properties": {
                        "success": {
                          "type": "boolean"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  
    const op = spec.getOperation("/widgets", OpenAPIV3.HttpMethods.POST);
    expect(op).not.toBeUndefined();
    if (!op) {
      throw new Error(`Operation not found`);
    }
  
    const stringParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "stringParam"),
      spec,
    );
    expectType("string", stringParamSchema);
  
    const objectParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "objectParam"),
      spec,
    );
    const typedObjectParamSchema = expectType("object", objectParamSchema);
    expectType("string", typedObjectParamSchema.properties.foo);
    expectType("number", typedObjectParamSchema.properties.bar);
  
    const stringArrayParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "stringArrayParam"),
      spec,
    );
    const typedStringArrayParamSchema = expectType("array", stringArrayParamSchema);
    expect(typedStringArrayParamSchema.items).not.toBeUndefined();
    expectType("string", typedStringArrayParamSchema.items);
  
    const nestedObjectInArrayParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "nestedObjectInArrayParam"),
      spec,
    );
    expectType("number",
      expectType("object",
        expectType("array", nestedObjectInArrayParamSchema).items
      ).properties.baz
    );
  
    const nestedArrayInObjectParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "nestedArrayInObjectParam"),
      spec,
    );
    expectType("string",
      expectType("array",
        expectType("object", nestedArrayInObjectParamSchema).properties.qux
      ).items
    );
  
    const inceptionParamSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "inceptionParam"),
      spec,
    );
    expectType("number",
      expectType("object",
        expectType("object",
          expectType("array",
            expectType("object",
              expectType("array", inceptionParamSchema).items
            ).properties.nestedArray
          ).items
        ).properties.nestedObject
      ).properties.inception
    );
  });

  test("handles circular references", () => {
    const spec = new OpenAPISpec({
      "openapi": "3.1.0",
      "info": {
        "title": "A fake spec for testing",
        "version": "0.0.1",
      },
      "components": {
        "schemas": {
          "Node": {
            "type": "object",
            "properties": {
              "children": {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/Node"
                }
              }
            }
          }
        }
      },
      "paths": {
        "/nodes": {
          "post": {
            "operationId": "createNode",
            "description": "Create a node",
            "parameters": [
              {
                "name": "node",
                "in": "query",
                "schema": {
                  "$ref": "#/components/schemas/Node"
                }
              }
            ],
            "responses": {
              "200": {
                "description": "OK",
                "content": {
                  "application/json": {
                    "schema": {
                      "$ref": "#/components/schemas/Node"
                    }
                  }
                }
              }
            }
          }
        }
      },
    });

    const op = spec.getOperation("/nodes", OpenAPIV3.HttpMethods.POST);
    expect(op).not.toBeUndefined();
    if (!op) {
      throw new Error(`Operation not found`);
    }

    const circularSchema = convertOpenAPISchemaToJSONSchema(
      getParamSchema(spec, op, "node"),
      spec,
    );

    console.log(JSON.stringify(circularSchema));
  });

  function getParamSchema(spec: OpenAPISpec, operation: OpenAPIV3_1.OperationObject, paramName: string) {
    const param = spec.getParametersForOperation(operation).find((param) => param.name === paramName);
    if (!param) {
      throw new Error(`Param not found`);
    }
    if (!param.schema) {
      throw new Error(`Param schema not found`);
    }
    return spec.getSchema(param.schema);
  }

  type TypeMap = {
    "string": JsonSchema7StringType,
    "number": JsonSchema7NumberType,
    "object": JsonSchema7ObjectType,
    "array": JsonSchema7ArrayType,
  };

  function expectType<T extends keyof TypeMap>(type: T, schema: any): TypeMap[T] {
    if (schema.type !== type) {
      throw new Error(`Unexpected type: ${schema.type}`);
    }
    return schema as TypeMap[T];
  }
});
